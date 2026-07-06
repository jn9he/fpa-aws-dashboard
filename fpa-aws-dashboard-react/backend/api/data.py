from fastapi import APIRouter, Query
from typing import Optional
from services.data_loader import load_data, apply_filters, MONTHS, ACTUAL_MONTHS, FORECAST_MONTHS, AWS_CAP, AWS_GROWTH_ACCOUNTS, ENDED_PROJECTS
from services.forecast_engine import (
    forecast_labor, forecast_aws,
    labor_monthly_summary, aws_monthly_summary,
    labor_by_project_summary, build_aws_validation_summary,
)

router = APIRouter(prefix="/api/data", tags=["data"])


def _get_forecasts():
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    aws_df = forecast_aws(aws_raw)
    return roster, project, labor_df, aws_df


@router.get("/summary")
def get_summary():
    roster, project, labor_df, aws_df = _get_forecasts()
    labor_month = labor_monthly_summary(labor_df)
    aws_month = aws_monthly_summary(aws_df)
    aws_val = build_aws_validation_summary(aws_df)

    labor_costs = labor_month["Labor Cost"].tolist()
    aws_costs = aws_month["AWS Cost"].tolist()

    total_labor = sum(labor_costs)
    total_aws = sum(aws_costs)
    total_fy = total_labor + total_aws

    avg_actual_labor = sum(labor_costs[:3]) / 3
    avg_forecast_labor = sum(labor_costs[3:]) / 9
    avg_actual_aws = sum(aws_costs[:3]) / 3
    avg_forecast_aws = sum(aws_costs[3:]) / 9

    delta_labor = avg_forecast_labor - avg_actual_labor
    delta_aws = avg_forecast_aws - avg_actual_aws
    delta_total = delta_labor + delta_aws

    return {
        "kpis": {
            "total_fy": total_fy,
            "total_labor": total_labor,
            "total_aws": total_aws,
            "delta_total": delta_total,
            "delta_labor": delta_labor,
            "delta_aws": delta_aws,
            "aws_variance_to_cap": aws_val["Variance to Cap"],
            "aws_over_cap": aws_val["Over Cap"],
        },
        "labor_monthly": [{"month": m, "cost": c} for m, c in zip(MONTHS, labor_costs)],
        "aws_monthly": [{"month": m, "cost": c} for m, c in zip(MONTHS, aws_costs)],
        "months": MONTHS,
        "actual_months": ACTUAL_MONTHS,
        "forecast_months": FORECAST_MONTHS,
    }


@router.get("/labor")
def get_labor(
    leader: Optional[str] = Query("All"),
    type: Optional[str] = Query("All"),
    location: Optional[str] = Query("All"),
    fbu: Optional[str] = Query("All"),
    project: Optional[str] = Query("All"),
):
    roster_df, project_df, labor_df, _ = _get_forecasts()
    filtered = apply_filters(labor_df, leader=leader, emp_type=type, location=location, fbu=fbu, project_name=project)

    cost_cols = [f"{m}_Cost" for m in MONTHS]
    filtered["Full Year Cost"] = filtered[cost_cols].sum(axis=1)

    records = filtered.where(filtered.notna(), None).to_dict(orient="records")
    return {"data": records, "count": len(records)}


@router.get("/aws")
def get_aws(
    svp: Optional[str] = Query("All"),
    employees: Optional[str] = Query(None),
):
    roster, _, _, aws_df = _get_forecasts()
    roster_df = roster[["Employee ID", "Supervisor 3"]]
    merged = aws_df.merge(roster_df, on="Employee ID", how="left")

    if svp != "All":
        merged = merged[merged["Supervisor 3"] == svp]

    if employees:
        emp_list = [e.strip() for e in employees.split(",")]
        merged = merged[merged["Employee Name"].isin(emp_list)]

    aws_val = build_aws_validation_summary(merged)
    aws_month = aws_monthly_summary(merged)

    records = merged.where(merged.notna(), None).to_dict(orient="records")
    return {
        "data": records,
        "count": len(records),
        "validation": aws_val,
        "monthly": [{"month": r["Month"], "cost": r["AWS Cost"]} for _, r in aws_month.iterrows()],
        "months": MONTHS,
        "aws_cap": AWS_CAP,
        "growth_accounts": AWS_GROWTH_ACCOUNTS,
    }


@router.get("/projects")
def get_projects():
    _, _, labor_df, _ = _get_forecasts()
    proj_summary = labor_by_project_summary(labor_df)

    # Compute Actual YTD (sum of actual months: Jan, Feb, Mar) grouped by project
    actual_cost_cols = [f"{m}_Cost" for m in ACTUAL_MONTHS]
    actual_ytd = (
        labor_df.groupby(["Project Number", "Project Name"])[actual_cost_cols]
        .sum()
        .sum(axis=1)
        .reset_index(name="Actual YTD")
    )

    # Get primary Owner per project (mode of Supervisor 3)
    owner = (
        labor_df.groupby(["Project Number", "Project Name"])["Supervisor 3"]
        .agg(lambda x: x.mode().iloc[0] if not x.mode().empty else "Unknown")
        .reset_index(name="Owner")
    )

    # Merge enrichments into proj_summary
    proj_summary = proj_summary.merge(actual_ytd, on=["Project Number", "Project Name"], how="left")
    proj_summary = proj_summary.merge(owner, on=["Project Number", "Project Name"], how="left")

    # Compute Delta = Full Year Cost - Actual YTD
    proj_summary["Actual YTD"] = proj_summary["Actual YTD"].fillna(0)
    proj_summary["Delta"] = proj_summary["Full Year Cost"] - proj_summary["Actual YTD"]

    # Rename Full Year Cost to Forecast for output
    proj_summary = proj_summary.rename(columns={"Full Year Cost": "Forecast"})

    output_cols = ["Project Number", "Project Name", "Owner", "Forecast", "Actual YTD", "Delta"]
    top5 = proj_summary[output_cols].head(5).to_dict(orient="records")
    all_projects = proj_summary[output_cols].to_dict(orient="records")
    return {"top5": top5, "all": all_projects}


@router.get("/bva")
def get_bva():
    """Budget vs Actual drill-down: Funding BU → Project → Employee with CapEx/OpEx."""
    _, _, labor_df, _ = _get_forecasts()

    cost_cols = [f"{m}_Cost" for m in MONTHS]
    actual_cost_cols = [f"{m}_Cost" for m in ACTUAL_MONTHS]

    # Budget = full year forecast cost, Actual = sum of actual months costs
    # Variance = prorated budget (budget * 3/12) - actual
    labor_df = labor_df.copy()
    labor_df["_budget"] = labor_df[cost_cols].sum(axis=1)
    labor_df["_actual"] = labor_df[actual_cost_cols].sum(axis=1)
    labor_df["_prorated_budget"] = labor_df["_budget"] * (len(ACTUAL_MONTHS) / 12)
    labor_df["_variance"] = labor_df["_prorated_budget"] - labor_df["_actual"]

    total_budget = labor_df["_budget"].sum()

    tree = []
    for fbu, fbu_df in labor_df.groupby("Funding Business Unit"):
        fbu_budget = fbu_df["_budget"].sum()
        fbu_actual = fbu_df["_actual"].sum()
        fbu_prorated = fbu_df["_prorated_budget"].sum()
        fbu_variance = fbu_prorated - fbu_actual
        fbu_variance_pct = (fbu_variance / fbu_prorated * 100) if fbu_prorated else 0

        projects = []
        for (pnum, pname), proj_df in fbu_df.groupby(["Project Number", "Project Name"]):
            classification = proj_df["Accounting Classification"].iloc[0] if "Accounting Classification" in proj_df.columns else "Unknown"
            proj_budget = proj_df["_budget"].sum()
            proj_actual = proj_df["_actual"].sum()
            proj_prorated = proj_df["_prorated_budget"].sum()
            proj_variance = proj_prorated - proj_actual
            proj_variance_pct = (proj_variance / proj_prorated * 100) if proj_prorated else 0

            employees = []
            for emp_name, emp_df in proj_df.groupby("Employee Name"):
                emp_budget = emp_df["_budget"].sum()
                emp_actual = emp_df["_actual"].sum()
                emp_prorated = emp_df["_prorated_budget"].sum()
                emp_variance = emp_prorated - emp_actual
                emp_variance_pct = (emp_variance / emp_prorated * 100) if emp_prorated else 0
                employees.append({
                    "name": emp_name,
                    "type": "employee",
                    "budget": round(emp_budget, 2),
                    "actual": round(emp_actual, 2),
                    "variance": round(emp_variance, 2),
                    "variance_pct": round(emp_variance_pct, 1),
                    "pct_of_total": round(emp_budget / total_budget * 100, 2) if total_budget else 0,
                    "classification": classification,
                })

            projects.append({
                "name": pname,
                "type": "project",
                "budget": round(proj_budget, 2),
                "actual": round(proj_actual, 2),
                "variance": round(proj_variance, 2),
                "variance_pct": round(proj_variance_pct, 1),
                "pct_of_total": round(proj_budget / total_budget * 100, 2) if total_budget else 0,
                "classification": classification,
                "children": sorted(employees, key=lambda x: x["budget"], reverse=True),
            })

        tree.append({
            "name": fbu,
            "type": "fbu",
            "budget": round(fbu_budget, 2),
            "actual": round(fbu_actual, 2),
            "variance": round(fbu_variance, 2),
            "variance_pct": round(fbu_variance_pct, 1),
            "pct_of_total": round(fbu_budget / total_budget * 100, 2) if total_budget else 0,
            "classification": "Mixed",
            "children": sorted(projects, key=lambda x: x["budget"], reverse=True),
        })

    tree.sort(key=lambda x: x["budget"], reverse=True)
    return {"tree": tree, "total_budget": round(total_budget, 2)}


@router.get("/roster")
def get_roster():
    roster, project, labor_df, _ = _get_forecasts()
    return {
        "leaders": sorted(labor_df["Supervisor 3"].dropna().unique().tolist()),
        "types": sorted(labor_df["Type"].dropna().unique().tolist()),
        "locations": sorted(labor_df["Location"].dropna().unique().tolist()),
        "fbus": sorted(labor_df["Funding Business Unit"].dropna().unique().tolist()),
        "projects": sorted(labor_df["Project Name"].dropna().unique().tolist()),
        "employees": sorted(labor_df["Employee Name"].dropna().unique().tolist()),
        "svp_groups": sorted(roster["Supervisor 3"].dropna().unique().tolist()),
    }


@router.get("/sankey")
def get_sankey():
    _, _, labor_df, _ = _get_forecasts()
    cost_cols = [f"{m}_Cost" for m in MONTHS]
    labor_df = labor_df.copy()
    labor_df["_fy_cost"] = labor_df[cost_cols].sum(axis=1)

    flow = labor_df.groupby(["Funding Business Unit", "Project Name", "Type"], as_index=False)["_fy_cost"].sum()
    flow = flow[flow["_fy_cost"] > 0]

    top_projects = flow.groupby("Project Name")["_fy_cost"].sum().nlargest(10).index.tolist()
    flow = flow[flow["Project Name"].isin(top_projects)]

    fbus = flow["Funding Business Unit"].unique().tolist()
    projects = flow["Project Name"].unique().tolist()
    types = flow["Type"].unique().tolist()
    nodes = fbus + projects + types

    fbu_colors = ["#DD6B20", "#D69E2E", "#4A5568", "#2D3748", "#C53030", "#DD6B20", "#D69E2E", "#4A5568"]
    fbu_color_map = {fbu: fbu_colors[i % len(fbu_colors)] for i, fbu in enumerate(fbus)}

    sources, targets, values, link_colors = [], [], [], []
    for _, row in flow.iterrows():
        sources.append(nodes.index(row["Funding Business Unit"]))
        targets.append(nodes.index(row["Project Name"]))
        values.append(row["_fy_cost"])
        link_colors.append(fbu_color_map[row["Funding Business Unit"]])

        sources.append(nodes.index(row["Project Name"]))
        targets.append(nodes.index(row["Type"]))
        values.append(row["_fy_cost"])
        link_colors.append(fbu_color_map[row["Funding Business Unit"]])

    return {
        "nodes": nodes,
        "node_colors": [fbu_color_map.get(n, "#4A5568") for n in nodes],
        "sources": sources,
        "targets": targets,
        "values": values,
        "link_colors": link_colors,
    }
