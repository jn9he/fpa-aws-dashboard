import streamlit as st
from components.theme import apply_theme
from utils.data_loader import load_data, MONTHS
from utils.forecast_engine import forecast_labor, forecast_aws
from utils.ai_engine import generate_rule_based_insights
from utils.rag_agent import get_agent_response

apply_theme()

# --- Load data ---
roster, project, eta, aws_raw = load_data()
labor_df = forecast_labor(eta, roster, project)
aws_df = forecast_aws(aws_raw)

# Dataframes for the agent
dfs = [roster, eta, project, aws_raw]

# --- Rule-based alerts (used as context) ---
insights = generate_rule_based_insights(labor_df, aws_df)
alerts_context = "\n".join(
    f"[{i['severity']}] {i['title']}: {i['message']}" for i in insights
)

# --- Page header ---
st.markdown("### 🤖 Ask Your Data")
st.caption("Chat with your FP&A data using AI. The agent executes pandas code to answer your questions.")

# --- Preset button ---
EXEC_SUMMARY_PROMPT = (
    "Provide a 2-3 paragraph executive summary of the 2026 budget covering "
    "overall financial outlook, key cost drivers, risks, and recommendations. "
    "Write for VP-level leadership."
)

if st.button("📊 Generate Executive Summary", type="primary"):
    st.session_state.setdefault("chat_history", [])
    st.session_state["chat_history"].append({"role": "user", "content": EXEC_SUMMARY_PROMPT})
    with st.spinner("Generating executive summary..."):
        try:
            response = get_agent_response(
                EXEC_SUMMARY_PROMPT, dfs, st.session_state["chat_history"][:-1], alerts_context
            )
        except Exception as e:
            response = f"⚠️ Error generating response: {e}"
    st.session_state["chat_history"].append({"role": "assistant", "content": response})
    st.rerun()

# --- Chat history display ---
if "chat_history" not in st.session_state:
    st.session_state["chat_history"] = []

for msg in st.session_state["chat_history"]:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

# --- Chat input ---
if user_input := st.chat_input("Ask a question about your data..."):
    st.session_state["chat_history"].append({"role": "user", "content": user_input})
    with st.chat_message("user"):
        st.markdown(user_input)

    with st.chat_message("assistant"):
        with st.spinner("Analyzing..."):
            try:
                response = get_agent_response(
                    user_input, dfs, st.session_state["chat_history"][:-1], alerts_context
                )
            except Exception as e:
                response = f"⚠️ Error: {e}"
        st.markdown(response)

    st.session_state["chat_history"].append({"role": "assistant", "content": response})

# --- Alerts expander ---
with st.expander("📊 Rule-Based Alerts", expanded=False):
    severity_styles = {
        "critical": ("🔴", "#C53030"),
        "warning": ("⚠️", "#DD6B20"),
        "info": ("ℹ️", "#4A5568"),
    }
    st.caption(f"{len(insights)} alerts detected")
    for i in insights:
        icon, color = severity_styles.get(i["severity"], ("", "#4A5568"))
        st.markdown(
            f'<div style="border-left:4px solid {color};background:#FDF6EC;'
            f'padding:0.5rem 0.75rem;border-radius:0.25rem;margin-bottom:0.5rem;color:#2D3748;">'
            f'<strong>{icon} {i["title"]}</strong> ({i["category"]})<br>{i["message"]}</div>',
            unsafe_allow_html=True,
        )
