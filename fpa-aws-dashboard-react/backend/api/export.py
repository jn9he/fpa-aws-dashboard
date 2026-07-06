from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from services.data_loader import load_data, MONTHS, ACTUAL_MONTHS
from services.forecast_engine import (
    forecast_labor, forecast_aws,
    labor_monthly_summary, aws_monthly_summary,
    labor_by_project_summary, build_aws_validation_summary,
)
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.units import inch
import io
from datetime import datetime

router = APIRouter(prefix="/api/export", tags=["export"])

# Custom colors
NAVY = colors.HexColor("#00477C")
GREEN = colors.HexColor("#0F5132")
RED = colors.HexColor("#B91C1C")


def _fmt_dollar(value):
    """Format a numeric value as a dollar string."""
    return f"${value:,.0f}"


@router.get("/pdf")
def export_pdf():
    # ── Load data and compute forecasts ──────────────────────────────────
    roster, project, eta, aws_raw = load_data()
    labor_df = forecast_labor(eta, roster, project)
    aws_df = forecast_aws(aws_raw)

    # Monthly summaries
    labor_month = labor_monthly_summary(labor_df)
    aws_month = aws_monthly_summary(aws_df)
    aws_val = build_aws_validation_summary(aws_df)

    labor_costs = labor_month["Labor Cost"].tolist()
    aws_costs = aws_month["AWS Cost"].tolist()

    # KPIs
    total_labor = sum(labor_costs)
    total_aws = sum(aws_costs)
    total_fy = total_labor + total_aws
    aws_variance_to_cap = aws_val["Variance to Cap"]

    # Top 5 projects (same logic as get_projects in data.py)
    proj_summary = labor_by_project_summary(labor_df)

    actual_cost_cols = [f"{m}_Cost" for m in ACTUAL_MONTHS]
    actual_ytd = (
        labor_df.groupby(["Project Number", "Project Name"])[actual_cost_cols]
        .sum()
        .sum(axis=1)
        .reset_index(name="Actual YTD")
    )

    owner = (
        labor_df.groupby(["Project Number", "Project Name"])["Supervisor 3"]
        .agg(lambda x: x.mode().iloc[0] if not x.mode().empty else "Unknown")
        .reset_index(name="Owner")
    )

    proj_summary = proj_summary.merge(actual_ytd, on=["Project Number", "Project Name"], how="left")
    proj_summary = proj_summary.merge(owner, on=["Project Number", "Project Name"], how="left")
    proj_summary["Actual YTD"] = proj_summary["Actual YTD"].fillna(0)
    proj_summary["Delta"] = proj_summary["Full Year Cost"] - proj_summary["Actual YTD"]
    proj_summary = proj_summary.rename(columns={"Full Year Cost": "Forecast"})
    top5 = proj_summary[["Project Name", "Owner", "Forecast", "Actual YTD", "Delta"]].head(5)

    # ── Build PDF ────────────────────────────────────────────────────────
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontSize=18,
        leading=22,
        textColor=NAVY,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.gray,
        spaceAfter=12,
    )
    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontSize=13,
        textColor=NAVY,
        spaceBefore=16,
        spaceAfter=8,
    )

    elements = []

    # Title and subtitle
    elements.append(Paragraph("FP&A Executive Summary Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%B %d, %Y %I:%M %p')}", subtitle_style))
    elements.append(Spacer(1, 12))

    # ── KPI Table ────────────────────────────────────────────────────────
    elements.append(Paragraph("Key Performance Indicators", section_style))

    kpi_data = [
        ["Full Year Forecast", "Labor Forecast", "AWS Forecast", "AWS Variance to Cap"],
        [_fmt_dollar(total_fy), _fmt_dollar(total_labor), _fmt_dollar(total_aws), _fmt_dollar(aws_variance_to_cap)],
    ]
    kpi_table = Table(kpi_data, colWidths=[1.7 * inch] * 4)
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(kpi_table)
    elements.append(Spacer(1, 16))

    # ── Top 5 Projects Table ─────────────────────────────────────────────
    elements.append(Paragraph("Top 5 Project Cost Drivers", section_style))

    proj_header = ["Project Name", "Owner", "Forecast", "Actual YTD", "Delta"]
    proj_data = [proj_header]
    for _, row in top5.iterrows():
        proj_data.append([
            str(row["Project Name"]),
            str(row["Owner"]),
            _fmt_dollar(row["Forecast"]),
            _fmt_dollar(row["Actual YTD"]),
            _fmt_dollar(row["Delta"]),
        ])

    proj_table = Table(proj_data, colWidths=[2.2 * inch, 1.5 * inch, 1.2 * inch, 1.2 * inch, 1.0 * inch])
    proj_style = [
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]

    # Color the Delta column based on positive/negative
    for i, (_, row) in enumerate(top5.iterrows(), start=1):
        if row["Delta"] >= 0:
            proj_style.append(("TEXTCOLOR", (4, i), (4, i), GREEN))
        else:
            proj_style.append(("TEXTCOLOR", (4, i), (4, i), RED))

    proj_table.setStyle(TableStyle(proj_style))
    elements.append(proj_table)
    elements.append(Spacer(1, 16))

    # ── Monthly Cost Summary Table ───────────────────────────────────────
    elements.append(Paragraph("Monthly Cost Summary", section_style))

    monthly_header = ["Month", "Labor Cost", "AWS Cost", "Total"]
    monthly_data = [monthly_header]
    for i, month in enumerate(MONTHS):
        labor_c = labor_costs[i]
        aws_c = aws_costs[i]
        total_c = labor_c + aws_c
        monthly_data.append([
            month,
            _fmt_dollar(labor_c),
            _fmt_dollar(aws_c),
            _fmt_dollar(total_c),
        ])

    monthly_table = Table(monthly_data, colWidths=[1.4 * inch, 1.8 * inch, 1.8 * inch, 1.8 * inch])
    monthly_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F7FAFC")]),
    ]))
    elements.append(monthly_table)

    # Build PDF
    doc.build(elements)

    # ── Return PDF as streaming response ─────────────────────────────────
    buffer.seek(0)
    return StreamingResponse(
        content=buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="FPA_Executive_Summary.pdf"'},
    )
