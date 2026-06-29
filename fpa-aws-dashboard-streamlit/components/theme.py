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

    .rc-overflow {
        position: fixed !important;
        top: 1rem !important;
        left: 50% !important;
        transform: translateX(-50%) !important;

        z-index: 9999 !important;

        background-color: #fef9f3 !important; /* adjust as needed */
        border: 2px solid #c0b599 !important; /* square border color */
        padding: 0.5rem 1rem !important;
        border-radius: 6px !important; /* slightly rounded corners */
        box-shadow: 0 3px 10px rgba(0,0,0,0.08) !important; /* decreased drop shadow */

        display: flex !important;
        gap: 1rem !important; /* space between nav items */
        width: auto !important;
        max-width: 90vw !important;
    }

    /* Style each nav item container */
    .rc-overflow-item {
        opacity: 1 !important;
        order: initial !important;
    }

    /* Style the nav links as buttons with clean square borders */
    a[data-testid="stTopNavLink"] {
        font-size: 1rem !important;
        font-weight: 600 !important;
        color: #2d3748 !important; /* dark slate color */
        padding: 0.375rem 0.75rem !important;
        border: 1px solid transparent !important;
        border-radius: 6px !important; /* slightly rounded corners */
        display: flex !important;
        align-items: center !important;
        gap: 0.4rem !important;
        text-decoration: none !important;
        white-space: nowrap !important;
        transition: background-color 0.25s ease, border-color 0.25s ease;
    }

    /* Hover effect */
    /* Remove border on hover but keep background and shadow */
    a[data-testid="stTopNavLink"]:hover {
        background-color: #e2d8bc !important;
        border-color: transparent !important; /* removed border on hover */
        color: #1a202c !important;
        /* keep shadow from navbar container */
    }

    /* Active/current page highlight */
    a[data-testid="stTopNavLink"][aria-current="page"] {
        background-color: #c0b599 !important;
        color: white !important;
        border-color: #c0b599 !important;
    }

    /* Icon styling */
    a[data-testid="stTopNavLink"] span[role="img"],
    a[data-testid="stTopNavLink"] span[data-testid="stIconMaterial"] {
        font-size: 1.2rem !important;
        color: inherit !important;
    }

    /* Adjust main content to not hide behind fixed navbar */
    .main .block-container {
        padding-top: 4rem !important;
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


