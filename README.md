# FP&A AWS Planning Dashboard

React-based financial planning & analysis tool for AWS resource and cost forecasting.

## Features

- **Executive Summary** — High-level KPIs and portfolio overview
- **Resource Forecasting** — Staff allocation and capacity planning
- **AWS Forecasting** — Cloud cost projections and trend analysis
- **Scenario Planner** — What-if modeling with adjustable parameters
- **AI Insights** — LLM-powered analysis via OpenAI and LangChain RAG running Pandas

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# Run the dashboard
streamlit run app.py
```

## Project Structure

```
app.py                 # Main entry point & navigation
pages/                 # Dashboard pages (1–5)
components/            # Shared UI components (theme, filters)
utils/                 # Data loading, forecasting, AI engine, RAG agent
data/                  # Source CSV files (roster, projects, AWS model, time allocation)
scenarios/             # Saved scenario configurations
docs/                  # Requirements, architecture, and planning docs
```

## Requirements

- Python 3.12+
- OpenAI API key (for AI Insights page)
