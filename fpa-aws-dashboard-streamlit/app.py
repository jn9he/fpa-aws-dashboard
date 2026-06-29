import streamlit as st

st.set_page_config(
    page_title="FP&A Planning Dashboard",
    page_icon=":bar_chart:",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# --- Shared session state defaults ---
_defaults = {
    "filter_leader": "All",
    "filter_type": "All",
    "filter_location": "All",
    "filter_fbu": "All",
    "filter_project": "All",
    "filter_dimension": "Funding Business Unit",
    "active_scenario": None,
    "overrides": {},
    "project_targets": {},
}
for k, v in _defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v

# --- Pages ---
pages = {
    "Executive Summary": st.Page("pages/1_Executive_Summary.py", title="Executive Summary", icon=":material/dashboard:"),
    "Resource Forecasting": st.Page("pages/2_Resource_Forecasting.py", title="Resource Forecasting", icon=":material/groups:"),
    "AWS Forecasting": st.Page("pages/3_AWS_Forecasting.py", title="AWS Forecasting", icon=":material/cloud:"),
    "Scenario Planner": st.Page("pages/4_Scenario_Planner.py", title="Scenario Planner", icon=":material/tune:"),
    "AI Insights": st.Page("pages/5_AI_Insights.py", title="AI Insights", icon=":material/psychology:"),
}

# --- Navbar styling ---
st.markdown("""
<style>
/* Hide sidebar nav */
[data-testid="stSidebarNav"] { display: none !important; }

/* Target the top navigation container - multiple selector strategies */
[data-testid="stNavigation"],
[data-testid="stTopNavigation"],
div[data-testid="stNavigation"],
nav,
[role="navigation"],
.stNavigation {
    border-bottom: 3px solid #C4C9D2 !important;
    border-top: 3px solid #C4C9D2 !important;
    padding: 1rem 2rem !important;
    background-color: #FFFAF0 !important;
    text-align: center !important;
}

/* Center the nav links list */
[data-testid="stNavigation"] ul,
[data-testid="stTopNavigation"] ul,
nav ul,
[role="navigation"] ul {
    justify-content: center !important;
    display: flex !important;
    flex-wrap: wrap !important;
}

/* Make nav text large and bold */
[data-testid="stNavigation"] a,
[data-testid="stNavigation"] button,
[data-testid="stNavigation"] span,
[data-testid="stNavigation"] p,
[data-testid="stTopNavigation"] a,
[data-testid="stTopNavigation"] span,
nav a, nav button, nav span,
[role="navigation"] a,
[role="navigation"] span {
    font-size: 1.8rem !important;
    font-weight: 700 !important;
    color: #2D3748 !important;
}
</style>
""", unsafe_allow_html=True)

pg = st.navigation(list(pages.values()), position="top")
pg.run()
