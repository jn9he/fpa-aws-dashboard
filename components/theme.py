"""Shared theme CSS injection for the Minimal Document Dashboard."""
import streamlit as st

# Color palette constants
CREAM = "#FFFAF0"
LINEN = "#FDF6EC"
DARK_EARTH = "#2D3748"
ORANGE = "#DD6B20"
SLATE = "#4A5568"
YELLOW = "#D69E2E"
BORDER = "#C4C9D2"
RED = "#C53030"


def apply_theme():
    """Inject global CSS for document-flow layout, spacing, and typography."""
    st.markdown("""
    <style>
    /* Centered content with max-width */
    .block-container {
        max-width: 1100px;
        padding: 2rem 2rem 4rem;
    }

    /* Section headers */
    h1 { color: """ + DARK_EARTH + """; font-weight: 600; }
    h2, h3 { margin-top: 2.5rem; color: """ + SLATE + """; font-weight: 500; }

    /* Hide sidebar nav links */
    [data-testid="stSidebarNav"] { display: none; }

    /* Subtle separators */
    hr { border-color: """ + BORDER + """; opacity: 0.5; }

    /* Metric styling */
    [data-testid="stMetric"] {
        background: """ + LINEN + """;
        border: 1px solid """ + BORDER + """;
        border-radius: 0.5rem;
        padding: 0.75rem 1rem;
    }
    [data-testid="stMetricValue"] { color: """ + DARK_EARTH + """; }
    [data-testid="stMetricLabel"] { color: """ + SLATE + """; }

    /* Navigation bar styling */
    [data-testid="stNavigation"],
    [data-testid="stTopNavigation"],
    nav, [role="navigation"] {
        border-bottom: 3px solid """ + BORDER + """ !important;
        border-top: 3px solid """ + BORDER + """ !important;
        padding: 1rem 2rem !important;
        background-color: """ + CREAM + """ !important;
    }
    [data-testid="stNavigation"] a,
    [data-testid="stNavigation"] span,
    nav a, nav span {
        font-size: 1.8rem !important;
        font-weight: 700 !important;
    }

    /* Filter pill styling */
    .filter-pill {
        display: inline-block;
        background: """ + ORANGE + """;
        color: """ + CREAM + """;
        padding: 0.25rem 0.75rem;
        border-radius: 1rem;
        font-size: 0.8rem;
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
    }
    .filter-pill a {
        color: """ + CREAM + """;
        text-decoration: none;
        margin-left: 0.4rem;
        font-weight: bold;
    }

    /* Expander styling */
    [data-testid="stExpander"] {
        border-color: """ + BORDER + """;
    }

    /* Chart containers - breathing room */
    [data-testid="stPlotlyChart"] {
        margin-bottom: 1rem;
    }
    </style>
    """, unsafe_allow_html=True)
