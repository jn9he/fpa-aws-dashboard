import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from components.theme import apply_theme
from utils.data_loader import (
    load_data, MONTHS, ACTUAL_MONTHS, AWS_CAP, AWS_GROWTH_ACCOUNTS,
    COLOR_ACTUAL, COLOR_FORECAST, COLOR_ALERT, COLOR_AWS,
)
from utils.forecast_engine import forecast_aws, aws_monthly_summary, build_aws_validation_summary

apply_theme()

roster, _, _, aws_raw = load_data()
aws_df = forecast_aws(aws_raw)

# Merge roster for SVP filter
aws_df = aws_df.merge(roster[["Employee ID", "Supervisor 3"]], on="Employee ID", how="left")

# --- Filters ---
st.markdown("### Filters")
f1, f2 = st.columns(2)
svp_opts = ["All"] + sorted(aws_df["Supervisor 3"].dropna().unique().tolist())
with f1:
    sel_svp = st.selectbox("SVP Group", svp_opts, key="aws_svp")
emp_pool = aws_df if sel_svp == "All" else aws_df[aws_df["Supervisor 3"] == sel_svp]
emp_opts = sorted(emp_pool["Employee Name"].dropna().unique().tolist())
with f2:
    sel_emps = st.multiselect("Employees", emp_opts, default=[], key="aws_emps")

filtered = emp_pool if not sel_emps else emp_pool[emp_pool["Employee Name"].isin(sel_emps)]

aws_val = build_aws_validation_summary(filtered)

# --- Alert banner ---
if aws_val["Over Cap"]:
    st.markdown(f"""
    <div style="border-left: 4px solid #C53030; background: #FDF6EC; padding: 1rem 1.25rem;
                border-radius: 0.25rem; margin-bottom: 1.5rem; color: #2D3748;">
        <strong>⚠ AWS forecast (${aws_val['Total AWS Forecast']:,.0f}) exceeds the ${AWS_CAP:,.0f} annual cap
        by ${abs(aws_val['Variance to Cap']):,.0f}.</strong>
    </div>
    """, unsafe_allow_html=True)

# --- KPI row ---
c1, c2, c3 = st.columns(3)
c1.metric("AWS Full Year Forecast", f"${aws_val['Total AWS Forecast']:,.0f}")
c2.metric("Annual Cap", f"${AWS_CAP:,.0f}")
c3.metric("Variance to Cap", f"${aws_val['Variance to Cap']:,.0f}",
          delta="Under" if not aws_val["Over Cap"] else "OVER",
          delta_color="normal" if not aws_val["Over Cap"] else "inverse")

# --- Top 5 Account KPIs ---
st.markdown("### Top 5 Cost-Driving Accounts")
acct_totals = filtered.groupby(["Account Number", "Employee Name"], as_index=False)["Full Year Forecast"].sum()
acct_totals = acct_totals.nlargest(5, "Full Year Forecast")
total_all = filtered["Full Year Forecast"].sum()

cols = st.columns(5)
for i, (_, row) in enumerate(acct_totals.iterrows()):
    pct = row["Full Year Forecast"] / total_all * 100 if total_all > 0 else 0
    cols[i].metric(row["Account Number"], f"${row['Full Year Forecast']:,.0f}",
                   delta=f"{pct:.1f}% of total")
    cols[i].caption(row["Employee Name"])

# --- Cost / Billed / Revenue line chart ---
st.markdown("### Monthly Cost, Billed Amount & Revenue")

monthly_cost = [filtered[m].sum() for m in MONTHS]
monthly_billed = [c * 1.1 for c in monthly_cost]
monthly_revenue = [c * 1.3 for c in monthly_cost]

fig_rev = go.Figure()
fig_rev.add_trace(go.Scatter(x=MONTHS, y=monthly_cost, mode="lines+markers",
                             name="Cost", line=dict(color=COLOR_AWS, width=2)))
fig_rev.add_trace(go.Scatter(x=MONTHS, y=monthly_billed, mode="lines+markers",
                             name="Billed Amount (1.1×)", line=dict(color=COLOR_ACTUAL, width=2, dash="dash")))
fig_rev.add_trace(go.Scatter(x=MONTHS, y=monthly_revenue, mode="lines+markers",
                             name="Revenue (1.3×)", line=dict(color="#38A169", width=2)))
fig_rev.update_layout(template="plotly_white", height=380, yaxis_title="Amount ($)",
                      paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                      margin=dict(l=60, r=20, t=20, b=40),
                      legend=dict(orientation="h", yanchor="bottom", y=-0.2, xanchor="center", x=0.5))
st.plotly_chart(fig_rev, width="stretch")

# --- Cumulative spend vs cap ---
st.markdown("### Cumulative AWS Spend vs Cap")

aws_month = aws_monthly_summary(filtered)
aws_month["Cumulative"] = aws_month["AWS Cost"].cumsum()

fig_cum = go.Figure()
fig_cum.add_trace(go.Scatter(
    x=aws_month["Month"], y=aws_month["Cumulative"],
    mode="lines+markers", fill="tozeroy",
    line=dict(color=COLOR_AWS, width=2), fillcolor="rgba(214,158,46,0.15)",
    name="Cumulative Spend",
))
fig_cum.add_hline(y=AWS_CAP, line_dash="dash", line_color=COLOR_ALERT,
                  annotation_text=f"Cap: ${AWS_CAP:,.0f}", annotation_position="top left")
fig_cum.update_layout(
    xaxis=dict(categoryorder="array", categoryarray=MONTHS),
    yaxis_title="Cumulative Cost ($)", template="plotly_white", height=380,
    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
    margin=dict(l=60, r=20, t=20, b=40),
)
st.plotly_chart(fig_cum, width="stretch")

# --- Account Trends + Stacked (side by side) ---
acct_long = filtered.melt(
    id_vars=["Account Number", "Employee Name"],
    value_vars=MONTHS, var_name="Month", value_name="Cost",
)
acct_long["Growth"] = acct_long["Account Number"].isin(AWS_GROWTH_ACCOUNTS)

col_left, col_right = st.columns(2)

with col_left:
    st.markdown("### Account Monthly Trends")
    fig_lines = px.line(
        acct_long, x="Month", y="Cost", color="Account Number",
        category_orders={"Month": MONTHS},
        line_dash="Growth", line_dash_map={True: "solid", False: "dot"},
        hover_data=["Employee Name"],
    )
    fig_lines.update_layout(template="plotly_white", height=300,
                            legend=dict(font=dict(size=8)),
                            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                            margin=dict(l=40, r=10, t=10, b=40))
    st.plotly_chart(fig_lines, width="stretch")

with col_right:
    st.markdown("### Monthly Cost by Account (Stacked)")
    fig_stack = px.bar(
        acct_long, x="Month", y="Cost", color="Account Number",
        category_orders={"Month": MONTHS},
        color_discrete_sequence=["#DD6B20", "#D69E2E", "#4A5568", "#2D3748", "#C53030",
                                 "#DD6B20", "#D69E2E", "#4A5568"],
    )
    fig_stack.update_layout(
        barmode="stack", template="plotly_white", height=300,
        legend=dict(font=dict(size=8)),
        paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=40, r=10, t=10, b=40),
    )
    st.plotly_chart(fig_stack, width="stretch")

# --- Assumptions ---
st.markdown("### Forecast Assumptions")
st.markdown(f"""
- **Growth accounts** ({', '.join(AWS_GROWTH_ACCOUNTS)}): 5% month-over-month from March.
- **All other accounts**: Jan–Mar weighted average applied to Apr–Dec.
- Annual cap monitored at **${AWS_CAP:,.0f}**.
- **Billed Amount**: Cost × 1.1 (mock). **Revenue**: Cost × 1.3 (mock).
""")
