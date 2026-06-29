import streamlit as st
from components.theme import apply_theme
from utils.data_loader import load_data, MONTHS
from utils.forecast_engine import forecast_labor, forecast_aws
from utils.ai_engine import generate_rule_based_insights
from utils.rag_agent import get_agent_response

apply_theme()
st.markdown("<div style='padding-top: 3rem;'></div>", unsafe_allow_html=True)

# --- Preset prompt configuration ---
PRESET_PROMPTS = [
    {
        "label": "\U0001f504 Recommended Changes & Forecasts",
        "prompt": (
            "Based on the 2026 budget data, what are the top 3-5 changes leadership should approve? "
            "For each, state the recommended action, rationale, and forecasted financial impact. "
            "Consider staffing reallocations, project sunsets, AWS cost growth, and underutilized capacity."
        ),
    },
    {
        "label": "\U0001f4b0 Capital vs. OpEx Breakdown",
        "prompt": (
            "Break down total 2026 labor spend by Accounting Classification (Capital Expense vs. Operating Expense) "
            "and show the monthly trend. Highlight which projects drive each category and flag any imbalance or risk."
        ),
    },
    {
        "label": "\U0001f465 Staffing & Capacity Risks",
        "prompt": (
            "Identify the top staffing and capacity risks for the remainder of 2026. "
            "Include employees near PTO caps, teams with uneven utilization, and any gaps created by project sunsets. "
            "Quantify the impact where possible."
        ),
    },
    {
        "label": "\u2601\ufe0f AWS Cost Forecast",
        "prompt": (
            "Summarize the AWS spend trajectory for 2026. Are we on track to stay under the $2.1M cap? "
            "Which accounts are driving growth, what is the projected year-end total, and what actions could reduce risk of a cap breach?"
        ),
    },
    {
        "label": "\U0001f4c8 Project Investment Mix",
        "prompt": (
            "Rank all active projects by total 2026 cost and show the investment mix across Funding Business Units. "
            "Which projects consume the most resources, which are sunsetting, and how should freed capacity be reallocated?"
        ),
    },
    {
        "label": "\U0001f4ca Year-End Budget Summary",
        "prompt": (
            "Provide a year-end budget summary for 2026. Show projected total spend vs. plan for both labor and AWS, "
            "identify the expected surplus or deficit, and highlight the top 3 drivers of any variance from the original budget."
        ),
    },
]

# --- Load data ---
roster, project, eta, aws_raw = load_data()
labor_df = forecast_labor(eta, roster, project)
aws_df = forecast_aws(aws_raw)
dfs = [roster, eta, project, aws_raw]

# --- Rule-based alerts (used as context) ---
insights = generate_rule_based_insights(labor_df, aws_df)
alerts_context = "\n".join(
    f"[{i['severity']}] {i['title']}: {i['message']}" for i in insights
)

# --- Page-scoped CSS ---
st.markdown("""
<style>
/* Expand the block container for this page */
.block-container {
    max-width: 1800px !important;
    padding: 1.5rem 2rem 2rem !important;
}

/* Preset button styling */
div[data-testid="stColumns"] .stButton > button {
    background: #FDF6EC;
    border: 1.5px solid #C4C9D2;
    border-radius: 0.5rem;
    color: #2D3748;
    font-weight: 700;
    padding: 0.6rem 1.2rem;
    width: 100%;
    text-align: left;
    transition: border-color 0.2s;
}
div[data-testid="stColumns"] .stButton > button:hover {
    border-color: #DD6B20;
    background: #FDF6EC;
    color: #2D3748;
}

/* Dot-grid background on the fixed-height chat container */
div[data-testid="stVerticalBlockBorderWrapper"]:has(> div > div > div[data-testid="stChatMessage"]) {
    background-image: radial-gradient(black 1px, transparent 0);
    background-size: 20px 20px;
    border-radius: 0.5rem;
    border: 1px solid #C4C9D2;
}

/* Chat input width matches container */
div[data-testid="stChatInput"] {
    max-width: 1700px;
    width: 100%;
    margin-left: auto;
    margin-right: auto;
}

div[data-testid="stBottom"] > div {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 2rem;
}

/* Alert badge styling */
.alert-badge {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border-radius: 0.75rem;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    margin-right: 0.5rem;
}
.alert-badge-critical { background: #FED7D7; color: #C53030; }
.alert-badge-warning { background: #FEEBC8; color: #DD6B20; }
.alert-badge-info { background: #E2E8F0; color: #4A5568; }
</style>
""", unsafe_allow_html=True)

# --- Page header ---
# st.markdown("### \U0001f916 AI Insights")

# --- Alerts section at top (collapsible with filtering) ---
SEVERITY_MAP = {"critical": "High", "warning": "Medium", "info": "Low"}
SEVERITY_COLORS = {
    "critical": ("\U0001f534", "#C53030", "alert-badge-critical"),
    "warning": ("\u26a0\ufe0f", "#DD6B20", "alert-badge-warning"),
    "info": ("\u2139\ufe0f", "#4A5568", "alert-badge-info"),
}

counts = {"critical": 0, "warning": 0, "info": 0}
for i in insights:
    counts[i["severity"]] = counts.get(i["severity"], 0) + 1

expander_title = (
    f"Alerts & Notifications: "
    f"\U0001f534 {counts['critical']} High \u00a0 "
    f"\u26a0\ufe0f {counts['warning']} Med \u00a0 "
    f"\u2139\ufe0f {counts['info']} Low"
)

with st.expander(expander_title, expanded=False):
    urgency_filter = st.radio(
        "Filter by urgency:",
        ["All", "High", "Medium", "Low"],
        horizontal=True,
        key="alert_urgency_filter",
    )

    # Filter alerts
    if urgency_filter == "All":
        filtered_alerts = insights
    else:
        reverse_map = {"High": "critical", "Medium": "warning", "Low": "info"}
        filtered_alerts = [i for i in insights if i["severity"] == reverse_map[urgency_filter]]

    if not filtered_alerts:
        st.info("No alerts matching the selected filter.")
    else:
        for alert in filtered_alerts:
            icon, color, badge_cls = SEVERITY_COLORS.get(alert["severity"], ("", "#4A5568", "alert-badge-info"))
            label = SEVERITY_MAP.get(alert["severity"], "Info")
            st.markdown(
                f'<div style="border-left:4px solid {color};background:#FDF6EC;'
                f'padding:0.6rem 0.85rem;border-radius:0.25rem;margin-bottom:0.5rem;color:#2D3748;">'
                f'<span class="alert-badge {badge_cls}">{label}</span>'
                f'<strong>{alert["title"]}</strong> <span style="color:#718096;">({alert["category"]})</span>'
                f'<br><span style="font-size:0.9rem;">{alert["message"]}</span></div>',
                unsafe_allow_html=True,
            )

st.markdown("")

# --- Initialize chat history ---
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = []

# --- Preset buttons in 3x2 grid ---
for row_start in range(0, 6, 3):
    cols = st.columns(3)
    for i, col in enumerate(cols):
        idx = row_start + i
        preset = PRESET_PROMPTS[idx]
        with col:
            if st.button(preset["label"], key=f"preset_{idx}", use_container_width=True):
                st.session_state["chat_history"].append({"role": "user", "content": preset["prompt"]})
                with st.spinner(f"Running: {preset['label']}..."):
                    try:
                        response = get_agent_response(
                            preset["prompt"], dfs, st.session_state["chat_history"][:-1], alerts_context
                        )
                    except Exception as e:
                        response = f"\u26a0\ufe0f Error generating response: {e}"
                st.session_state["chat_history"].append({"role": "assistant", "content": response})
                st.rerun()

st.markdown("")

# --- Fixed-height scrollable chat container (dot-grid background applied via CSS) ---
chat_container = st.container(height=580)
with chat_container:
    if not st.session_state["chat_history"]:
        st.markdown(
            '<div style="text-align:center;color:#718096;padding:3rem 1rem;">'
            '\U0001f4ac Ask a question using the presets above or type below to get started.</div>',
            unsafe_allow_html=True,
        )
    else:
        for msg in st.session_state["chat_history"]:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

# --- Chat input (anchored below the chat container) ---
if user_input := st.chat_input("Ask a question about your data..."):
    st.session_state["chat_history"].append({"role": "user", "content": user_input})
    with chat_container:
        with st.chat_message("user"):
            st.markdown(user_input)
        with st.chat_message("assistant"):
            with st.spinner("Analyzing..."):
                try:
                    response = get_agent_response(
                        user_input, dfs, st.session_state["chat_history"][:-1], alerts_context
                    )
                except Exception as e:
                    response = f"\u26a0\ufe0f Error: {e}"
            st.markdown(response)
    st.session_state["chat_history"].append({"role": "assistant", "content": response})
