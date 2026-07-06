import time
from fastapi import APIRouter
from pydantic import BaseModel
from services.data_loader import load_data, MONTHS, ACTUAL_MONTHS, AWS_CAP
from services.forecast_engine import forecast_labor, forecast_aws
from services.ai_engine import generate_rule_based_insights

router = APIRouter(prefix="/api/ai", tags=["ai"])

# --- Cache for AI alerts ---
_alerts_cache: dict = {"alerts": [], "timestamp": 0, "fallback": True}
_CACHE_TTL = 300  # 5 minutes


class ChatRequest(BaseModel):
    message: str
    history: list[dict] = []


@router.get("/insights")
def get_insights():
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    aws_df = forecast_aws(aws_raw)
    insights = generate_rule_based_insights(labor_df, aws_df)
    return {"insights": insights, "stream": False}


@router.get("/alerts")
def get_alerts():
    """AI-generated 'so what' alerts for dashboard banners. Cached for 5 minutes."""
    global _alerts_cache

    now = time.time()
    if now - _alerts_cache["timestamp"] < _CACHE_TTL and _alerts_cache["alerts"]:
        return {"alerts": _alerts_cache["alerts"], "fallback": _alerts_cache["fallback"]}

    # Gather metrics
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    aws_df = forecast_aws(aws_raw)

    cost_cols = [f"{m}_Cost" for m in MONTHS]
    actual_cost_cols = [f"{m}_Cost" for m in ACTUAL_MONTHS]

    total_labor_fy = labor_df[cost_cols].sum().sum()
    total_labor_actual = labor_df[actual_cost_cols].sum().sum()
    labor_monthly_avg = total_labor_fy / 12
    labor_actual_avg = total_labor_actual / len(ACTUAL_MONTHS)

    aws_fy_total = aws_df["Full Year Forecast"].sum() if "Full Year Forecast" in aws_df.columns else aws_df[MONTHS].sum().sum()
    aws_monthly_avg = aws_fy_total / 12
    aws_variance_to_cap = AWS_CAP - aws_fy_total

    total_fy = total_labor_fy + aws_fy_total
    monthly_budget_rate = total_fy / 12

    # Top variance project
    proj_costs = labor_df.groupby("Project Name")[cost_cols].sum().sum(axis=1)
    proj_actual = labor_df.groupby("Project Name")[actual_cost_cols].sum().sum(axis=1)
    proj_prorated = proj_costs * (len(ACTUAL_MONTHS) / 12)
    proj_variance = proj_prorated - proj_actual
    top_over_project = proj_variance.idxmin() if not proj_variance.empty else "Unknown"
    top_over_amount = proj_variance.min() if not proj_variance.empty else 0

    # Build context for LLM
    metrics_context = f"""
Key Financial Metrics (FY2026):
- Total FY Forecast: ${total_fy:,.0f} (Labor: ${total_labor_fy:,.0f} + AWS: ${aws_fy_total:,.0f})
- Monthly Budget Rate: ${monthly_budget_rate:,.0f}/month
- Labor Actual Avg (Jan-Mar): ${labor_actual_avg:,.0f}/month vs Forecast Avg: ${labor_monthly_avg:,.0f}/month
- AWS FY Forecast: ${aws_fy_total:,.0f} vs Cap: ${AWS_CAP:,.0f} (Variance: ${aws_variance_to_cap:,.0f})
- AWS Run Rate: ${aws_monthly_avg:,.0f}/month
- Top Over-Budget Project: {top_over_project} (${abs(top_over_amount):,.0f} over prorated plan)
- AWS is {'OVER' if aws_fy_total > AWS_CAP else 'UNDER'} cap by ${abs(aws_variance_to_cap):,.0f}
"""

    try:
        from services.rag_agent import get_llm
        llm = get_llm()

        prompt = f"""You are an FP&A analyst. Based on these metrics, generate exactly 3 concise, actionable alert messages for a financial dashboard.

{metrics_context}

Rules:
- Each alert must be ONE sentence, max 120 characters
- Be specific with numbers and timeframes
- Use the style: "[Metric] is [X]% [above/below] [target], [consequence/action]"
- Assign severity: critical (budget breach/risk), warning (trending concern), info (positive or neutral insight)
- Assign page: executive (overall), aws (AWS-specific), resources (labor-specific)

Return EXACTLY this JSON format, no other text:
[
  {{"severity": "critical|warning|info", "message": "...", "page": "executive|aws|resources"}},
  {{"severity": "critical|warning|info", "message": "...", "page": "executive|aws|resources"}},
  {{"severity": "critical|warning|info", "message": "...", "page": "executive|aws|resources"}}
]"""

        response = llm.invoke(prompt)
        import json
        content = response.content.strip()
        # Handle markdown code blocks
        if content.startswith("```"):
            content = content.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        alerts = json.loads(content)

        # Validate structure
        valid_alerts = []
        for a in alerts:
            if isinstance(a, dict) and "severity" in a and "message" in a and "page" in a:
                if a["severity"] in ("critical", "warning", "info") and a["page"] in ("executive", "aws", "resources"):
                    valid_alerts.append(a)

        _alerts_cache = {"alerts": valid_alerts, "timestamp": now, "fallback": False}
        return {"alerts": valid_alerts, "fallback": False}

    except Exception as e:
        # Fallback: generate simple rule-based alerts
        fallback_alerts = []

        if aws_fy_total > AWS_CAP:
            pct_over = (aws_fy_total - AWS_CAP) / AWS_CAP * 100
            fallback_alerts.append({
                "severity": "critical",
                "message": f"AWS spend projected ${aws_fy_total:,.0f} — exceeds ${AWS_CAP:,.0f} cap by {pct_over:.1f}%",
                "page": "aws",
            })
        elif aws_variance_to_cap < AWS_CAP * 0.1:
            fallback_alerts.append({
                "severity": "warning",
                "message": f"AWS forecast within ${aws_variance_to_cap:,.0f} of cap — monitor growth accounts closely",
                "page": "aws",
            })

        if top_over_amount < 0:
            fallback_alerts.append({
                "severity": "warning",
                "message": f"{top_over_project} is ${abs(top_over_amount):,.0f} over prorated budget through {ACTUAL_MONTHS[-1]}",
                "page": "executive",
            })

        labor_drift = (labor_actual_avg - labor_monthly_avg) / labor_monthly_avg * 100
        if abs(labor_drift) > 5:
            direction = "above" if labor_drift > 0 else "below"
            fallback_alerts.append({
                "severity": "info",
                "message": f"Labor actuals trending {abs(labor_drift):.1f}% {direction} forecast rate — review resource allocation",
                "page": "resources",
            })

        _alerts_cache = {"alerts": fallback_alerts, "timestamp": now, "fallback": True}
        return {"alerts": fallback_alerts, "fallback": True}


@router.post("/chat")
def chat(req: ChatRequest):
    try:
        from services.rag_agent import get_agent_response
        roster, project, eta, aws_raw = load_data()
        dfs = [roster, eta, project, aws_raw]

        # Build alerts context
        labor_df = forecast_labor(eta, roster, project)
        aws_df = forecast_aws(aws_raw)
        insights = generate_rule_based_insights(labor_df, aws_df)
        alerts_context = "\n".join(f"[{i['severity']}] {i['title']}: {i['message']}" for i in insights)

        response = get_agent_response(req.message, dfs, req.history, alerts_context)
        return {"response": response, "format": "markdown", "stream": False}
    except Exception as e:
        return {"response": f"⚠️ Error: {e}", "format": "markdown", "stream": False}
