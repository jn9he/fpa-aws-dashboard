# Requirements Specification — Enhanced FP&A Planning Dashboard

## 1. Business Context

This application serves as an automated planning tool for a Spectrum business unit, enabling leaders to forecast and manage:
- **Resource project and cost forecasting** — labor cost projections across employees, projects, and organizational hierarchies
- **AWS hosting cost forecasting** — cloud infrastructure cost projections by account with growth modeling

The tool must allow leaders at multiple levels to view, interact with, and adjust forecasts while AI explains the numbers and tells the story of the organization.

### Source Data

| File | Description | Key Fields |
|---|---|---|
| `roster.csv` | Employee hierarchy, pay rates, locations | Employee ID, Name, Type (FTE/Contractor), Hourly Rate, Location, Supervisors |
| `project-list.csv` | Project metadata and classifications | Project Number, Name, Investment Category, Accounting Classification, Funding BU |
| `time-allocation.csv` | Hours allocated per employee per project per month | Employee ID, Project Number, Jan–Dec hours |
| `aws-model.csv` | AWS account costs by month | Account Number, Owner, Jan–Dec costs |

### Business Assumptions (from requirements document)

- Jan–Mar are actuals; Apr–Dec are forecasted
- All resources have 160 hours total per month
- FTE PTO cap: 160 hours/year; Contractor PTO cap: 120 hours/year
- Roster is static (no hires, no attrition)
- Projects P00010 and P00014 end after August; resources reallocated
- Total AWS spend shall not exceed $2.1M for the year
- AWS accounts 8, 11, 27 grow 5% MoM from March; others use YTD weighted average

---

## 2. Visualization Requirements

### 2.1 KPI Cards with Trend Indicators

**Description:** Metric cards displaying key financial figures with directional trend arrows comparing forecast trajectory to actuals baseline.

**Metrics:**
- Total Full-Year Forecast (Labor + AWS)
- Labor Forecast Total
- AWS Forecast Total
- AWS Variance to $2.1M Cap
- Average Monthly Forecast Cost
- Funds Allocated (Actuals as % of Full Year)

**Behavior:**
- Delta indicators show month-over-month change direction
- Green = favorable trend, Red = unfavorable trend

### 2.2 Sparklines

**Description:** Inline miniature line charts embedded alongside KPI cards showing 12-month cost progression.

**Behavior:**
- One sparkline per KPI showing Jan–Dec trend
- Actuals portion in blue, forecast portion in orange
- No axis labels — purely visual trend indicator

### 2.3 Sankey Diagram

**Description:** Flow diagram showing budget allocation from funding sources through projects to resource types.

**Nodes:**
- Level 1: Funding Business Units (Customer Operations, Technology, Product, etc.)
- Level 2: Top 10 projects by cost
- Level 3: Employee Types (FTE, Contractor)

**Links:** Weighted by full-year labor cost

**Behavior:**
- Hover shows dollar amount on each link
- Color coded by funding business unit
- Interactive — click to highlight a flow path

### 2.4 Treemap

**Description:** Hierarchical area chart showing budget composition with drill-down capability.

**Hierarchy:** Funding Business Unit → Project → Employee Name

**Behavior:**
- Area proportional to full-year cost
- Click to drill into lower levels
- Color intensity indicates cost magnitude
- Respects active sidebar filters

### 2.5 Waterfall Chart

**Description:** Shows how total labor cost builds up from component categories.

**Categories:**
- Base Labor (project work)
- PTO Allocation
- Meetings
- Project Sunset Reallocation Impact (negative for ended projects, positive for receiving projects)

**Behavior:**
- Running total from left to right
- Green for positive contributions, red for reductions
- Final bar shows grand total

### 2.6 Heatmap

**Description:** Color-coded grid showing hours allocation intensity.

**Views (toggle):**
- By Employee: employees on y-axis, months on x-axis, cell value = total hours
- By Project: projects on y-axis, months on x-axis, cell value = total hours allocated

**Behavior:**
- Color scale from white (0 hours) to dark blue (160 hours)
- Post-sunset cells (P00010/P00014 after August) highlighted distinctly
- Hover shows exact hour value

### 2.7 Cumulative AWS Cap Chart

**Description:** Area chart showing cumulative AWS spend building toward the annual $2.1M cap.

**Behavior:**
- X-axis: months; Y-axis: cumulative dollars
- Shaded area shows actual + forecast build-up
- Horizontal reference line at $2.1M cap
- Alert annotation if trajectory exceeds cap
- Growth accounts (8, 11, 27) shown as separate overlay lines

### 2.8 AWS Account Trend Lines

**Description:** Individual line charts per AWS account showing monthly cost trajectory.

**Behavior:**
- Growth accounts (5% MoM) highlighted with a distinct color/marker
- Non-growth accounts shown with flatter trend lines
- Legend identifies account number and owner

### 2.9 AWS Stacked Bar

**Description:** Monthly stacked bar chart showing each account's contribution to total AWS cost.

**Behavior:**
- Each bar segment = one account's cost for that month
- Color coded by account
- Hover shows account number, owner, and dollar amount

---

## 3. AI Commentary Requirements

### 3.1 Rule-Based Insights Engine

**Description:** Deterministic alert system that analyzes forecast data against business rules and generates prioritized notifications.

**Rules:**

| # | Rule | Trigger | Severity |
|---|---|---|---|
| 1 | PTO Cap Proximity | Employee PTO usage > 80% of annual cap | Warning |
| 2 | MoM Cost Swing | Project cost changes > 20% month-over-month | Warning |
| 3 | AWS Growth Alert | Growth accounts trending toward cap breach | Critical |
| 4 | Top Cost Drivers | Identifies top 3 projects by total cost | Info |
| 5 | Project Sunset Impact | Quantifies reallocation from P00010/P00014 | Info |
| 6 | Hour Constraint Violation | Employee monthly hours ≠ 160 | Critical |
| 7 | AWS Cap Breach | Total AWS forecast > $2.1M | Critical |

**Output Format:**
```python
{
    "severity": "critical" | "warning" | "info",
    "category": "labor" | "aws" | "constraint",
    "title": "Short alert title",
    "message": "Detailed explanation with specific numbers",
    "affected_entities": ["EMP0001", "P00010", ...]
}
```

**Display:** Prioritized list sorted by severity (critical → warning → info), with icons (🔴, ⚠️, ℹ️) and expandable detail sections.

### 3.2 OpenAI LLM Narrative Generation

**Description:** On-demand natural-language summary that "tells the story" of the organization's financial outlook.

**Trigger:** User clicks "Generate AI Summary" button

**Prompt Context Includes:**
- Total budget (labor + AWS)
- Labor/AWS split percentages
- Top 5 projects by cost
- Key trends (increasing/decreasing months)
- Rule-based alerts (as context for the LLM)
- Project sunset impact summary
- AWS cap status
- Active scenario name (if any)

**Output:** 2-3 paragraph markdown narrative covering:
- Overall financial outlook
- Key drivers and trends
- Risks and recommendations

**Configuration:**
- Model: configurable (default GPT-4o-mini)
- API key: via `st.secrets["OPENAI_API_KEY"]` or `OPENAI_API_KEY` env var
- Graceful degradation: informative message if key is missing, no crash

---

## 4. Editable Forecast Requirements

### 4.1 Employee-Level Overrides

**Description:** Managers can directly edit individual employee hour allocations per project per month.

**Interface:** `st.data_editor` grid with:
- Rows: one per employee × project combination
- Columns: month columns (Apr–Dec) are editable; Jan–Mar are read-only (actuals)
- Additional read-only columns: Employee Name, Project Name, Hourly Rate

**Validation:**
- Per-employee monthly total must equal 160 hours
- Visual flag (red highlight) when constraint violated
- PTO hours cannot exceed annual cap

**Real-time updates:**
- Cost recalculated immediately: `hours × hourly_rate`
- Monthly totals and full-year totals update on edit
- Overrides stored as deltas in session state

### 4.2 Project-Level Adjustments

**Description:** Set a target budget or total hours for a project; system auto-distributes across assigned employees.

**Interface:**
- Table of projects with current total forecast hours and cost
- Input field for target (budget in $ or hours)
- Toggle: "Distribute by Budget" or "Distribute by Hours"

**Distribution Logic:**
- Proportional to each employee's current baseline allocation on that project
- If an employee hits 160-hour cap on any month, excess redistributes to remaining employees
- Resulting allocations pushed to the employee-level grid

**Validation:**
- Same 160-hour constraint applies after redistribution
- Warnings shown if redistribution creates constraint violations

### 4.3 Scenario Comparison

**Description:** Named scenarios represent different forecast assumptions. Users can compare scenarios side-by-side.

**Comparison View:**
- Side-by-side KPI table: Scenario A vs Scenario B vs Baseline
- Overlay line chart: monthly cost trend for each scenario
- Delta table: absolute and percentage differences per dimension

---

## 5. Scenario Persistence Requirements

### 5.1 Save Scenario

**Data Stored:**
```json
{
    "name": "Aggressive Growth",
    "description": "Surge on mobile projects through Q3",
    "created_at": "2026-06-23T10:30:00",
    "overrides": {
        "EMP0001|P00002|Apr": 80.0,
        "EMP0001|P00002|May": 90.0
    },
    "project_targets": {
        "P00003": {"type": "budget", "value": 50000.0}
    }
}
```

**Storage:** `scenarios/{sanitized_name}.json`

### 5.2 Load Scenario

- Dropdown populated from `scenarios/` directory
- Loading applies all overrides to session state
- Forecast engine recalculates with overrides applied
- All pages reflect loaded scenario

### 5.3 Delete Scenario

- Confirmation prompt before deletion
- Removes JSON file from disk
- If deleted scenario was active, reverts to baseline

### 5.4 List Scenarios

- Shows all saved scenarios with name, description, and creation timestamp
- Sorted by most recent first

---

## 6. AWS Cap Handling Requirements

### 6.1 Display Approach

The dashboard shows the **uncapped forecast** (actual projected costs based on the model) alongside a **cap alert** when the forecast exceeds $2.1M.

### 6.2 Forecast Model

| Account Type | Methodology |
|---|---|
| Growth accounts (8, 11, 27) | 5% month-over-month compounding from March actuals |
| All other accounts | YTD weighted average (Jan–Mar mean applied to Apr–Dec) |

### 6.3 Cap Monitoring

- Prominent metric card showing variance to cap (positive = under, negative = over)
- Alert banner (red, full-width) displayed on AWS page when forecast > $2.1M
- Cumulative chart with horizontal cap reference line
- AI insights engine flags cap breach as a critical alert

### 6.4 No Auto-Scaling

Per design decision: the tool does **not** automatically pro-rate or reduce forecasted AWS costs to fit within the cap. It surfaces the variance and alerts the user, who can then adjust via the Scenario Planner if desired.

---

## 7. Filtering and Navigation Requirements

### 7.1 Shared Sidebar Filters

| Filter | Options | Affects |
|---|---|---|
| Leader (Supervisor 3) | All + unique values | All pages |
| Employee Type | All, FTE, Contractor | All pages |
| Location | All + unique values | All pages |
| Funding Business Unit | All + unique values | All pages |
| Project | All + unique values | All pages |
| Breakdown Dimension | FBU, Accounting Class, Type, Location, Supervisors | Resource page groupings |

### 7.2 Filter Persistence

- Filters stored in `st.session_state` and persist across page navigation
- Changing a filter triggers re-computation on the active page
- "Reset All Filters" button available

### 7.3 Page Navigation

- Streamlit native multi-page sidebar navigation
- Pages named with numeric prefix for ordering: `1_`, `2_`, etc.
- Each page is self-contained but imports shared utilities

---

## 8. Non-Functional Requirements

| Category | Requirement |
|---|---|
| Performance | Page load < 3 seconds for all visualizations with full dataset |
| Caching | Data loading cached via `@st.cache_data`; forecasts recompute only when overrides change |
| Error Handling | Graceful degradation — missing API key shows message, missing data shows placeholder |
| Browser Support | Chrome, Edge, Firefox (latest versions) |
| Responsiveness | `layout="wide"` with responsive Plotly charts |
| Data Safety | No data leaves the local environment except OpenAI API calls (opt-in only) |
| Dependency Management | All packages pinned in `requirements.txt` |
