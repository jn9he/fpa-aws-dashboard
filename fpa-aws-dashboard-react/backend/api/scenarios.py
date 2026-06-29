from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
import json
from sqlalchemy.orm import Session
from models.database import get_db, Scenario
from services.data_loader import load_data, MONTHS, FORECAST_MONTHS, ACTUAL_MONTHS
from services.forecast_engine import forecast_labor, labor_monthly_summary

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


class ScenarioCreate(BaseModel):
    name: str
    description: str = ""
    overrides: dict = {}
    project_targets: dict = {}


class TransferRequest(BaseModel):
    employee: str
    source_project: str
    dest_project: str
    months: list[str]
    mode: str = "full"
    hours: float = 0


class SunsetRequest(BaseModel):
    project: str
    last_active_month: str


class LayoffRequest(BaseModel):
    employee: str
    effective_month: str
    mode: str = "savings"


@router.get("")
def list_scenarios(db: Session = Depends(get_db)):
    return [s.to_dict() for s in db.query(Scenario).all()]


@router.post("")
def create_scenario(body: ScenarioCreate, db: Session = Depends(get_db)):
    s = Scenario(name=body.name, description=body.description,
                 overrides=json.dumps(body.overrides), project_targets=json.dumps(body.project_targets))
    db.add(s)
    db.commit()
    db.refresh(s)
    return s.to_dict()


@router.get("/compare")
def compare_scenarios(a: int, b: int, db: Session = Depends(get_db)):
    sa = db.query(Scenario).filter(Scenario.id == a).first()
    sb = db.query(Scenario).filter(Scenario.id == b).first()
    if not sa or not sb:
        raise HTTPException(404, "Scenario not found")
    _, _, labor_df, _ = _forecasts()
    baseline = labor_monthly_summary(labor_df)
    return {
        "a": sa.to_dict(),
        "b": sb.to_dict(),
        "baseline_monthly": [{"month": r["Month"], "cost": r["Labor Cost"]} for _, r in baseline.iterrows()],
    }


def _forecasts():
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    return roster, project, labor_df, None


@router.get("/{scenario_id}")
def get_scenario(scenario_id: int, db: Session = Depends(get_db)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    return s.to_dict()


@router.put("/{scenario_id}")
def update_scenario(scenario_id: int, body: ScenarioCreate, db: Session = Depends(get_db)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    s.name = body.name
    s.description = body.description
    s.overrides = json.dumps(body.overrides)
    s.project_targets = json.dumps(body.project_targets)
    db.commit()
    return s.to_dict()


@router.delete("/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    s = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not s:
        raise HTTPException(404, "Scenario not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


@router.post("/what-if/transfer")
def what_if_transfer(req: TransferRequest):
    _, _, labor_df, _ = _forecasts()
    emp_rows = labor_df[labor_df["Employee Name"] == req.employee]
    if emp_rows.empty:
        raise HTTPException(404, "Employee not found")

    rate = emp_rows["Hourly Rate"].iloc[0]
    source_row = emp_rows[emp_rows["Project Name"] == req.source_project]
    dest_row = emp_rows[emp_rows["Project Name"] == req.dest_project]

    results = []
    for m in req.months:
        src_before = source_row[m].sum() if not source_row.empty else 0
        dst_before = dest_row[m].sum() if not dest_row.empty else 0
        moved = src_before if req.mode == "full" else min(req.hours, src_before)
        results.append({
            "month": m, "source_before": src_before, "source_after": src_before - moved,
            "dest_before": dst_before, "dest_after": dst_before + moved, "hrs_moved": moved,
        })

    total_moved = sum(r["hrs_moved"] for r in results)
    violations = [r["month"] for r in results if r["source_after"] < 0]
    return {
        "results": results,
        "total_hours_moved": total_moved,
        "cost_impact": total_moved * rate,
        "rate": rate,
        "violations": violations,
    }


@router.post("/what-if/sunset")
def what_if_sunset(req: SunsetRequest):
    _, _, labor_df, _ = _forecasts()
    sunset_idx = FORECAST_MONTHS.index(req.last_active_month)
    affected_months = FORECAST_MONTHS[sunset_idx + 1:]
    if not affected_months:
        return {"affected_employees": [], "total_hours_freed": 0}

    affected = labor_df[labor_df["Project Name"] == req.project]
    redistribution = []
    for _, emp_row in affected.iterrows():
        emp_id = emp_row["Employee ID"]
        emp_name = emp_row["Employee Name"]
        rate = emp_row["Hourly Rate"]
        freed_total = sum(emp_row[m] for m in affected_months)
        cost_freed = freed_total * rate
        others = labor_df[(labor_df["Employee ID"] == emp_id) & (labor_df["Project Name"] != req.project) & (labor_df["Project Number"] != "P00015")]
        if others.empty:
            target = "Meetings (default)"
        else:
            weights = others[affected_months].sum(axis=1)
            target = others.loc[weights.idxmax(), "Project Name"] if weights.sum() > 0 else "Meetings"
        redistribution.append({"employee": emp_name, "hours_freed": freed_total, "cost_freed": cost_freed, "redistributed_to": target})

    return {"affected_employees": redistribution, "total_hours_freed": sum(r["hours_freed"] for r in redistribution)}


@router.post("/what-if/layoff")
def what_if_layoff(req: LayoffRequest):
    _, _, labor_df, _ = _forecasts()
    emp_rows = labor_df[labor_df["Employee Name"] == req.employee]
    if emp_rows.empty:
        raise HTTPException(404, "Employee not found")

    rate = emp_rows["Hourly Rate"].iloc[0]
    layoff_idx = FORECAST_MONTHS.index(req.effective_month)
    affected_months = FORECAST_MONTHS[layoff_idx:]

    if req.mode == "savings":
        monthly = [{"month": m, "hours_saved": emp_rows[m].sum(), "cost_saved": emp_rows[m].sum() * rate} for m in affected_months]
        return {"monthly": monthly, "total_saved": sum(r["cost_saved"] for r in monthly), "total_hours": sum(r["hours_saved"] for r in monthly)}
    else:
        redist = []
        for _, proj_row in emp_rows.iterrows():
            proj_hrs = sum(proj_row[m] for m in affected_months)
            if proj_hrs <= 0:
                continue
            others = labor_df[(labor_df["Project Name"] == proj_row["Project Name"]) & (labor_df["Employee Name"] != req.employee)]
            if others.empty:
                redist.append({"project": proj_row["Project Name"], "hours": proj_hrs, "receiving": "(unassigned)", "hrs_per_month": proj_hrs / len(affected_months), "risk": "No other employees"})
            else:
                per_person = proj_hrs / len(others) / len(affected_months)
                for _, other in others.iterrows():
                    curr = sum(other[m] for m in affected_months) / len(affected_months)
                    risk = "Over 160" if curr + per_person > 160 else "OK"
                    redist.append({"project": proj_row["Project Name"], "hours": proj_hrs / len(others), "receiving": other["Employee Name"], "hrs_per_month": per_person, "risk": risk})
        return {"redistribution": redist, "total_hours": sum(r["hours"] for r in redist)}
