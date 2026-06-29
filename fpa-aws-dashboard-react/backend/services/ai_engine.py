"""AI insights engine — rule-based alerts + OpenAI narrative generation."""
import os
from openai import AzureOpenAI
from services.data_loader import (
    MONTHS, ACTUAL_MONTHS, FORECAST_MONTHS,
    PTO_PROJECT, ENDED_PROJECTS, AWS_GROWTH_ACCOUNTS, AWS_CAP,
)


def generate_rule_based_insights(labor_df, aws_df):
    """Run all rules against current data, return prioritized alert list."""
    insights = []

    # Rule 1: PTO cap proximity (>80% used)
    for emp_id, emp_df in labor_df.groupby("Employee ID"):
        emp_type = emp_df["Type"].iloc[0]
        pto_cap = 160 if emp_type == "FTE" else 120
        pto_total = emp_df.loc[emp_df["Project Number"] == PTO_PROJECT, MONTHS].sum().sum()
        if pto_total > pto_cap * 0.8:
            pct = pto_total / pto_cap * 100
            insights.append({
                "severity": "warning",
                "category": "labor",
                "title": "PTO Cap Proximity",
                "message": f"{emp_df['Employee Name'].iloc[0]} ({emp_type}) at {pct:.0f}% of {pto_cap}hr PTO cap ({pto_total:.0f} hrs used).",
                "affected_entities": [emp_id],
            })

    # Rule 2: Projects with >20% MoM cost swing
    cost_cols = [f"{m}_Cost" for m in MONTHS]
    proj_monthly = labor_df.groupby("Project Name")[cost_cols].sum()
    for proj_name, row in proj_monthly.iterrows():
        costs = row.values
        for i in range(1, len(costs)):
            prev = costs[i - 1]
            curr = costs[i]
            if prev > 0 and abs(curr - prev) / prev > 0.20:
                change_pct = (curr - prev) / prev * 100
                insights.append({
                    "severity": "warning",
                    "category": "labor",
                    "title": "MoM Cost Swing",
                    "message": f"{proj_name}: {change_pct:+.0f}% change from {MONTHS[i-1]} to {MONTHS[i]} (${prev:,.0f} -> ${curr:,.0f}).",
                    "affected_entities": [proj_name],
                })
                break  # one alert per project

    # Rule 3: AWS growth accounts & cap proximity
    aws_fy_total = aws_df["Full Year Forecast"].sum() if "Full Year Forecast" in aws_df.columns else aws_df[MONTHS].sum().sum()
    if aws_fy_total > AWS_CAP:
        over = aws_fy_total - AWS_CAP
        insights.append({
            "severity": "critical",
            "category": "aws",
            "title": "AWS Cap Breach",
            "message": f"Total AWS forecast ${aws_fy_total:,.0f} exceeds ${AWS_CAP:,.0f} cap by ${over:,.0f}.",
            "affected_entities": [],
        })

    growth_total = aws_df[aws_df["Account Number"].isin(AWS_GROWTH_ACCOUNTS)]["Full Year Forecast"].sum() if "Full Year Forecast" in aws_df.columns else 0
    if growth_total > 0:
        insights.append({
            "severity": "info",
            "category": "aws",
            "title": "AWS Growth Accounts",
            "message": f"Accounts {', '.join(AWS_GROWTH_ACCOUNTS)} growing 5% MoM — combined forecast ${growth_total:,.0f}.",
            "affected_entities": AWS_GROWTH_ACCOUNTS,
        })

    # Rule 4: Top 3 cost drivers
    proj_totals = labor_df.groupby("Project Name")[cost_cols].sum().sum(axis=1).nlargest(3)
    top_list = [f"{name} (${cost:,.0f})" for name, cost in proj_totals.items()]
    insights.append({
        "severity": "info",
        "category": "labor",
        "title": "Top Cost Drivers",
        "message": f"Top 3 projects by cost: {'; '.join(top_list)}.",
        "affected_entities": proj_totals.index.tolist(),
    })

    # Rule 5: Project sunset reallocation impact
    ended_costs = labor_df[labor_df["Project Number"].isin(ENDED_PROJECTS)]
    if not ended_costs.empty:
        jan_aug = ended_costs[[f"{m}_Cost" for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]]].sum().sum()
        sep_dec = ended_costs[[f"{m}_Cost" for m in ["Sep", "Oct", "Nov", "Dec"]]].sum().sum()
        insights.append({
            "severity": "info",
            "category": "labor",
            "title": "Project Sunset Impact",
            "message": f"Projects {', '.join(ENDED_PROJECTS)} end after August. Jan-Aug cost: ${jan_aug:,.0f}. Sep-Dec cost drops to ${sep_dec:,.0f} (hours reallocated).",
            "affected_entities": ENDED_PROJECTS,
        })

    # Rule 6: Hour constraint violations
    violations = 0
    for emp_id, emp_df in labor_df.groupby("Employee ID"):
        for m in FORECAST_MONTHS:
            if abs(emp_df[m].sum() - 160) > 0.01:
                violations += 1
                break
    if violations > 0:
        insights.append({
            "severity": "critical",
            "category": "constraint",
            "title": "Hour Constraint Violations",
            "message": f"{violations} employee(s) have months not summing to 160 hours.",
            "affected_entities": [],
        })

    # Sort by severity
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    insights.sort(key=lambda x: severity_order.get(x["severity"], 3))

    return insights


def generate_llm_narrative(context: dict) -> str:
    """Call Azure OpenAI API with forecast context and return markdown narrative."""
    try:
        api_key = os.environ.get("AZURE_OPENAI_API_KEY", "")
        endpoint = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
        deployment = os.environ.get("AZURE_OPENAI_DEPLOYMENT", "")
        api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")

        if not api_key or not endpoint or not deployment:
            return "_Error: Configure AZURE_OPENAI_API_KEY, AZURE_OPENAI_ENDPOINT, and AZURE_OPENAI_DEPLOYMENT in .env_"

        client = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )

        prompt = f"""You are a financial planning analyst for a Spectrum business unit. 
Based on the following forecast data, write a 2-3 paragraph executive narrative that tells the story of this organization's 2026 budget.
Cover: overall financial outlook, key cost drivers, risks, and recommendations.

Data Context:
{context}

Write in a professional but accessible tone suitable for VP-level leadership."""

        response = client.chat.completions.create(
            model=deployment,
            messages=[{"role": "user", "content": prompt}],
            max_completion_tokens=500,
        )
        return response.choices[0].message.content

    except Exception as e:
        return f"_Error generating narrative: {e}_"
