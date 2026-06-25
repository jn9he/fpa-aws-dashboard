"""Shared filter component with pill-chip pattern."""
import streamlit as st
from utils.data_loader import apply_filters

# Session state keys for filters
FILTER_KEYS = {
    "filter_leader": "Leader",
    "filter_type": "Employee Type",
    "filter_location": "Location",
    "filter_fbu": "Funding BU",
    "filter_project": "Project",
}


def render_filters(df):
    """Render pill-chip filters with expander. Returns filtered DataFrame."""
    # Show active filter pills
    active = {k: v for k, v in FILTER_KEYS.items() if st.session_state.get(k, "All") != "All"}
    if active:
        pills_html = ""
        for key, label in active.items():
            val = st.session_state[key]
            pills_html += f'<span class="filter-pill">{label}: {val} <a href="?clear={key}">✕</a></span>'
        st.markdown(pills_html, unsafe_allow_html=True)

        # Handle pill removal via buttons (since HTML links won't work for state)
        cols = st.columns(len(active) + 1)
        for i, (key, label) in enumerate(active.items()):
            if cols[i].button(f"✕ {st.session_state[key]}", key=f"rm_{key}"):
                st.session_state[key] = "All"
                st.rerun()
        if cols[-1].button("Reset All", key="reset_filters"):
            for k in FILTER_KEYS:
                st.session_state[k] = "All"
            st.rerun()

    # Filter expander with dropdowns
    with st.expander("Filters", expanded=not bool(active)):
        c1, c2, c3, c4, c5 = st.columns(5)

        leader_opts = ["All"] + sorted(df["Supervisor 3"].dropna().unique().tolist())
        type_opts = ["All"] + sorted(df["Type"].dropna().unique().tolist())
        location_opts = ["All"] + sorted(df["Location"].dropna().unique().tolist())
        fbu_opts = ["All"] + sorted(df["Funding Business Unit"].dropna().unique().tolist())
        project_opts = ["All"] + sorted(df["Project Name"].dropna().unique().tolist())

        with c1:
            leader = st.selectbox("Leader", leader_opts,
                                  index=leader_opts.index(st.session_state.get("filter_leader", "All")),
                                  key="flt_leader")
        with c2:
            emp_type = st.selectbox("Type", type_opts,
                                    index=type_opts.index(st.session_state.get("filter_type", "All")),
                                    key="flt_type")
        with c3:
            location = st.selectbox("Location", location_opts,
                                    index=location_opts.index(st.session_state.get("filter_location", "All")),
                                    key="flt_loc")
        with c4:
            fbu = st.selectbox("Funding BU", fbu_opts,
                               index=fbu_opts.index(st.session_state.get("filter_fbu", "All")),
                               key="flt_fbu")
        with c5:
            proj = st.selectbox("Project", project_opts,
                                index=project_opts.index(st.session_state.get("filter_project", "All")),
                                key="flt_proj")

        # Sync to session state
        st.session_state["filter_leader"] = leader
        st.session_state["filter_type"] = emp_type
        st.session_state["filter_location"] = location
        st.session_state["filter_fbu"] = fbu
        st.session_state["filter_project"] = proj

    # Apply filters and return
    return apply_filters(
        df,
        st.session_state.get("filter_leader", "All"),
        st.session_state.get("filter_type", "All"),
        st.session_state.get("filter_location", "All"),
        st.session_state.get("filter_fbu", "All"),
        st.session_state.get("filter_project", "All"),
    )
