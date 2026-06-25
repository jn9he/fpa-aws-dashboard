import pandas as pd
import numpy as np
from utils.data_loader import (
    MONTHS, ACTUAL_MONTHS, FORECAST_MONTHS,
    PTO_PROJECT, MEETINGS_PROJECT, ENDED_PROJECTS,
    AWS_GROWTH_ACCOUNTS, AWS_CAP, clean_currency,
)


def forecast_labor(eta, roster, project):
    df = eta.copy()
    for m in MONTHS:
        if m in df.columns:
            df[m] = pd.to_numeric(df[m], errors="coerce").fillna(0)

    df = df.merge(
        roster[["Employee ID", "Employee Name", "Type", "Hourly Rate", "Location",
                "Supervisor 2", "Supervisor 3", "Supervisor 4"]],
        on=["Employee ID", "Employee Name"], how="left",
    )
    df = df.merge(
        project[["Project Number", "Project Name", "Investment Category",
                 "Accounting Classification", "Funding Business Unit", "Asset Type"]],
        on=["Project Number", "Project Name"], how="left",
    )
    df["Base_Avg_Hours"] = df[ACTUAL_MONTHS].mean(axis=1)

    forecast_rows = []
    for emp_id, emp_df in df.groupby("Employee ID", dropna=False):
        emp_df = emp_df.copy()
        emp_type = emp_df["Type"].iloc[0]
        pto_cap = 160 if emp_type == "FTE" else 120

        actual_pto_ytd = emp_df.loc[emp_df["Project Number"] == PTO_PROJECT, ACTUAL_MONTHS].sum().sum()
        remaining_pto = max(pto_cap - actual_pto_ytd, 0)
        monthly_pto_target = remaining_pto / len(FORECAST_MONTHS)

        # Ensure PTO row exists
        if PTO_PROJECT not in emp_df["Project Number"].values:
            row = emp_df.iloc[[0]].copy()
            row["Project Number"] = PTO_PROJECT
            row["Project Name"] = "Paid Time Off"
            row["Investment Category"] = "Opex"
            row["Accounting Classification"] = "Operating Expense"
            row["Funding Business Unit"] = "General"
            row["Asset Type"] = "Resources"
            for m in MONTHS:
                row[m] = 0
            row["Base_Avg_Hours"] = 0
            emp_df = pd.concat([emp_df, row], ignore_index=True)

        # Ensure Meetings row exists
        if MEETINGS_PROJECT not in emp_df["Project Number"].values:
            row = emp_df.iloc[[0]].copy()
            row["Project Number"] = MEETINGS_PROJECT
            row["Project Name"] = "Meetings"
            row["Investment Category"] = "Opex"
            row["Accounting Classification"] = "Operating Expense"
            row["Funding Business Unit"] = "General"
            row["Asset Type"] = "Resources"
            for m in MONTHS:
                row[m] = 0
            row["Base_Avg_Hours"] = 0
            emp_df = pd.concat([emp_df, row], ignore_index=True)

        # Set forecast months: scale Q1 averages proportionally to 160 hours
        non_pto_mask = emp_df["Project Number"] != PTO_PROJECT
        base_total = emp_df.loc[non_pto_mask, "Base_Avg_Hours"].sum()
        available_hours = 160 - monthly_pto_target  # hours after PTO

        for m in FORECAST_MONTHS:
            if base_total > 0:
                emp_df.loc[non_pto_mask, m] = emp_df.loc[non_pto_mask, "Base_Avg_Hours"] / base_total * available_hours
            else:
                emp_df[m] = 0

        # PTO allocation
        pto_mask = emp_df["Project Number"] == PTO_PROJECT
        for m in FORECAST_MONTHS:
            emp_df.loc[pto_mask, m] = monthly_pto_target

        # Project sunset: zero out ended projects after August
        ended_mask = emp_df["Project Number"].isin(ENDED_PROJECTS)
        for m in ["Sep", "Oct", "Nov", "Dec"]:
            ended_hours = emp_df.loc[ended_mask, m].sum()
            emp_df.loc[ended_mask, m] = 0
            active_mask = ~emp_df["Project Number"].isin(ENDED_PROJECTS + [PTO_PROJECT, MEETINGS_PROJECT])
            active_total = emp_df.loc[active_mask, m].sum()
            if active_total > 0:
                weights = emp_df.loc[active_mask, m] / active_total
                emp_df.loc[active_mask, m] += weights * ended_hours
            else:
                emp_df.loc[emp_df["Project Number"] == MEETINGS_PROJECT, m] += ended_hours

        # Normalize to 160 hours using meetings as buffer
        for m in FORECAST_MONTHS:
            diff = 160 - emp_df[m].sum()
            mtg_mask = emp_df["Project Number"] == MEETINGS_PROJECT
            emp_df.loc[mtg_mask, m] += diff

            if emp_df.loc[mtg_mask, m].sum() < 0:
                negative_amt = abs(emp_df.loc[mtg_mask, m].sum())
                emp_df.loc[mtg_mask, m] = 0
                reducible_mask = emp_df["Project Number"] != PTO_PROJECT
                reducible_total = emp_df.loc[reducible_mask, m].sum()
                if reducible_total > 0:
                    emp_df.loc[reducible_mask, m] -= (emp_df.loc[reducible_mask, m] / reducible_total) * negative_amt
                    emp_df[m] = emp_df[m].clip(lower=0)

            final_diff = 160 - emp_df[m].sum()
            emp_df.loc[mtg_mask, m] += final_diff

        forecast_rows.append(emp_df)

    out = pd.concat(forecast_rows, ignore_index=True)
    for m in MONTHS:
        out[f"{m}_Cost"] = out[m].fillna(0) * out["Hourly Rate"]
    return out


def forecast_aws(aws):
    df = aws.copy()
    for col in ["Jan", "Feb", "Mar", "Full Year"]:
        if col in df.columns:
            df[col] = clean_currency(df[col])

    df["Q1_Avg"] = df[["Jan", "Feb", "Mar"]].mean(axis=1)
    for m in FORECAST_MONTHS:
        df[m] = df["Q1_Avg"]

    growth_mask = df["Account Number"].isin(AWS_GROWTH_ACCOUNTS)
    prev_col = "Mar"
    for m in FORECAST_MONTHS:
        df.loc[growth_mask, m] = df.loc[growth_mask, prev_col] * 1.05
        prev_col = m

    df["Full Year Forecast"] = df[MONTHS].sum(axis=1)
    return df


# -----------------------------
# Summary helpers
# -----------------------------
def labor_monthly_summary(labor_df):
    rows = []
    for m in MONTHS:
        rows.append({
            "Month": m,
            "Labor Cost": labor_df[f"{m}_Cost"].sum(),
            "Labor Hours": labor_df[m].sum(),
            "Type": "Actual" if m in ACTUAL_MONTHS else "Forecast",
        })
    return pd.DataFrame(rows)


def labor_by_project_summary(labor_df):
    cost_cols = [f"{m}_Cost" for m in MONTHS]
    summary = labor_df.groupby(["Project Number", "Project Name"], as_index=False)[cost_cols].sum()
    summary["Full Year Cost"] = summary[cost_cols].sum(axis=1)
    return summary.sort_values("Full Year Cost", ascending=False)


def labor_by_dimension(labor_df, dimension="Funding Business Unit"):
    cost_cols = [f"{m}_Cost" for m in MONTHS]
    summary = labor_df.groupby(dimension, as_index=False)[cost_cols].sum()
    summary["Full Year Cost"] = summary[cost_cols].sum(axis=1)
    return summary.sort_values("Full Year Cost", ascending=False)


def project_end_impact(labor_df):
    impacted = labor_df[labor_df["Project Number"].isin(ENDED_PROJECTS)].copy()
    if impacted.empty:
        return pd.DataFrame(columns=["Project Number", "Project Name", "Jan_Aug_Cost", "Sep_Dec_Cost"])
    impacted["Jan_Aug_Cost"] = impacted[[f"{m}_Cost" for m in ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"]]].sum(axis=1)
    impacted["Sep_Dec_Cost"] = impacted[[f"{m}_Cost" for m in ["Sep", "Oct", "Nov", "Dec"]]].sum(axis=1)
    return impacted.groupby(["Project Number", "Project Name"], as_index=False)[["Jan_Aug_Cost", "Sep_Dec_Cost"]].sum()


def aws_monthly_summary(aws_df):
    rows = []
    for m in MONTHS:
        rows.append({
            "Month": m,
            "AWS Cost": aws_df[m].sum(),
            "Type": "Actual" if m in ACTUAL_MONTHS else "Forecast",
        })
    return pd.DataFrame(rows)


def aws_account_summary(aws_df):
    summary = aws_df[["Account Number", "Employee Name"] + MONTHS].copy()
    summary["Full Year Forecast"] = summary[MONTHS].sum(axis=1)
    return summary.sort_values("Full Year Forecast", ascending=False)


# -----------------------------
# Validation
# -----------------------------
def build_labor_validation_table(labor_df):
    rows = []
    for emp_id, emp_df in labor_df.groupby("Employee ID"):
        emp_type = emp_df["Type"].iloc[0]
        pto_cap = 160 if emp_type == "FTE" else 120
        row = {
            "Employee ID": emp_id,
            "Employee Name": emp_df["Employee Name"].iloc[0],
            "Type": emp_type,
            "PTO Cap": pto_cap,
        }
        for m in MONTHS:
            row[f"{m}_Total_Hours"] = emp_df[m].sum()
        pto_total = emp_df.loc[emp_df["Project Number"] == PTO_PROJECT, MONTHS].sum().sum()
        row["Full_Year_PTO"] = pto_total
        row["PTO_Over_Cap"] = pto_total > pto_cap
        month_issues = [abs(row[f"{m}_Total_Hours"] - 160) > 0.01 for m in FORECAST_MONTHS]
        row["Monthly_Hour_Issue"] = any(month_issues)
        rows.append(row)
    return pd.DataFrame(rows)


def build_aws_validation_summary(aws_df):
    total = aws_df["Full Year Forecast"].sum()
    return {
        "Total AWS Forecast": total,
        "AWS Cap": AWS_CAP,
        "Variance to Cap": AWS_CAP - total,
        "Over Cap": total > AWS_CAP,
    }
