import streamlit as st
import pandas as pd
import numpy as np
from pathlib import Path

# -----------------------------
# Constants
# -----------------------------
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ACTUAL_MONTHS = ["Jan", "Feb", "Mar"]
FORECAST_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

COLOR_ACTUAL = "#4A5568"
COLOR_FORECAST = "#DD6B20"
COLOR_LABOR = "#DD6B20"
COLOR_AWS = "#D69E2E"
COLOR_ALERT = "#C53030"
COLOR_NEUTRAL = "#4A5568"

PTO_PROJECT = "P00015"
MEETINGS_PROJECT = "P00017"
ENDED_PROJECTS = ["P00010", "P00014"]
AWS_GROWTH_ACCOUNTS = ["AWS00008", "AWS00011", "AWS00027"]
AWS_CAP = 2_100_000

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

# -----------------------------
# Helpers
# -----------------------------
def clean_currency(series):
    return (
        series.astype(str)
        .str.replace("$", "", regex=False)
        .str.replace(",", "", regex=False)
        .replace("nan", np.nan)
        .replace("", np.nan)
        .astype(float)
    )


@st.cache_data
def load_data():
    roster = pd.read_csv(DATA_DIR / "roster.csv")
    project = pd.read_csv(DATA_DIR / "project-list.csv")
    eta = pd.read_csv(DATA_DIR / "time-allocation.csv")
    aws = pd.read_csv(DATA_DIR / "aws-model.csv")

    roster["Hourly Rate"] = clean_currency(roster["Hourly Rate"])

    for col in ["Jan", "Feb", "Mar", "Full Year"]:
        if col in aws.columns:
            aws[col] = clean_currency(aws[col])

    for col in MONTHS:
        if col in eta.columns:
            eta[col] = pd.to_numeric(eta[col], errors="coerce").fillna(0)

    return roster, project, eta, aws


def apply_filters(df, leader="All", emp_type="All", location="All", fbu="All", project_name="All"):
    out = df.copy()
    if leader != "All":
        out = out[out["Supervisor 3"] == leader]
    if emp_type != "All":
        out = out[out["Type"] == emp_type]
    if location != "All":
        out = out[out["Location"] == location]
    if fbu != "All":
        out = out[out["Funding Business Unit"] == fbu]
    if project_name != "All":
        out = out[out["Project Name"] == project_name]
    return out
