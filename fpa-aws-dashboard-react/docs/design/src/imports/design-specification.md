# FP&A AWS Planning Dashboard — Design Specification

> **Purpose:** Comprehensive UI/UX specification for Figma mockup creation  
> **Version:** 1.0  
> **Date:** June 30, 2026  
> **Stack:** React + TypeScript + Tailwind CSS + Plotly.js  

---

## 1. Global Layout & Navigation

### 1.1 App Shell

| Property | Value |
|----------|-------|
| Layout | Full-width, max-w-7xl centered container |
| Top padding | 96px (pt-24) to clear floating navbar |
| Side padding | 16px (px-4) |
| Bottom padding | 32px (pb-8) |
| Background | Solid color from theme token `--background` |
| Font | system-ui, -apple-system, sans-serif |

### 1.2 Floating Pill Navbar

**Position:** Fixed, top-center, `top: 16px`, horizontally centered via `left-1/2 -translate-x-1/2`, z-50.

**Shape:** Rounded pill (`rounded-2xl`), `px-2 py-2` internal padding.

**Visual Treatment:**
- Background: `bg-card/80` (80% opacity card color) with `backdrop-blur-xl`
- Border: 1px solid `border` token
- Shadow: `shadow-lg shadow-black/10`

**Nav Items (5):**

| Route | Label | Icon (Material Rounded) |
|-------|-------|------------------------|
| `/` | Summary | DashboardRounded |
| `/resources` | Resources | GroupsRounded |
| `/aws` | AWS | CloudRounded |
| `/scenarios` | Scenarios | TuneRounded |
| `/ai` | AI Insights | AutoAwesomeRounded |

**Item States:**
- Default: `text-muted-foreground`, no background
- Hover: `text-foreground`, `bg-muted/20`
- Active: `bg-accent text-accent-foreground shadow-sm`

**Item Layout:** Flex row, icon (18px) + label text. Labels hidden on mobile (`hidden md:inline`).

**Theme Toggle:** Separated by a vertical 1px divider (`w-px h-6 bg-border mx-1`). Shows DarkModeRounded in light mode, LightModeRounded in dark mode. Same hover state as nav items.

### 1.3 Responsive Behavior

- Navbar labels collapse on screens < md breakpoint (768px)
- Page grids adapt: 1 col on mobile → 2–4 cols on desktop
- Charts are fully responsive via Plotly `responsive: true`

---

## 2. Design Tokens & Color System

### 2.1 Light Theme

| Token | RGB Values | Hex | Usage |
|-------|-----------|-----|-------|
| `--background` | 251 249 255 | #fbf9ff | Page background |
| `--foreground` | 0 8 7 | #000807 | Primary text |
| `--card` | 245 243 250 | #f5f3fa | Card surfaces |
| `--card-foreground` | 0 8 7 | #000807 | Card text |
| `--primary` | 17 95 160 | #115fa0 | Buttons, active elements, chart primary |
| `--primary-foreground` | 251 249 255 | #fbf9ff | Text on primary |
| `--accent` | 179 183 238 | #b3b7ee | Active nav highlight, chart secondary |
| `--accent-foreground` | 0 8 7 | #000807 | Text on accent |
| `--muted` | 162 163 187 | #a2a3bb | Disabled/secondary UI |
| `--muted-foreground` | 80 82 100 | #505264 | Secondary text, labels |
| `--border` | 194 196 210 | #c2c4d2 | All borders |
| `--ring` | 17 95 160 | #115fa0 | Focus rings |

### 2.2 Dark Theme

| Token | RGB Values | Hex | Usage |
|-------|-----------|-----|-------|
| `--background` | 0 8 7 | #000807 | Page background |
| `--foreground` | 251 249 255 | #fbf9ff | Primary text |
| `--card` | 10 20 18 | #0a1412 | Card surfaces |
| `--card-foreground` | 251 249 255 | #fbf9ff | Card text |
| `--primary` | 17 95 160 | #115fa0 | Buttons, active elements |
| `--primary-foreground` | 251 249 255 | #fbf9ff | Text on primary |
| `--accent` | 179 183 238 | #b3b7ee | Active nav highlight |
| `--accent-foreground` | 0 8 7 | #000807 | Text on accent |
| `--muted` | 162 163 187 | #a2a3bb | Disabled/secondary UI |
| `--muted-foreground` | 200 202 220 | #c8cadc | Secondary text |
| `--border` | 40 50 55 | #283237 | All borders |
| `--ring` | 179 183 238 | #b3b7ee | Focus rings |

### 2.3 Chart Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| Actuals | #a2a3bb | #a2a3bb | Actual period data (Jan–Mar) |
| Forecast/Primary | #115fa0 | #b3b7ee | Forecast period data (Apr–Dec) |
| AWS Growth | #115fa0 | #b3b7ee | Growth account highlight |
| Alert/Over Cap | #dc2626 | #dc2626 | Red alerts, violations |
| Success/Under | #10b981 (emerald-500) | #10b981 | Positive/favorable indicators |
| FBU Series | `['#115fa0','#b3b7ee','#a2a3bb','#3c82be','#6470a0','#1a8060','#d97706','#7c3aed','#dc2626','#0891b2']` | Same | Multi-category charts |

### 2.4 Typography

| Element | Size | Weight | Color Token |
|---------|------|--------|-------------|
| Page section headers | text-lg (18px) | font-semibold (600) | foreground |
| KPI value | text-2xl (24px) | font-bold (700) | foreground |
| KPI label | text-sm (14px) | normal (400) | muted-foreground |
| KPI delta | text-sm (14px) | font-medium (500) | emerald-500 or red-500 |
| Table header | text-sm (14px) | normal | primary-foreground on primary bg |
| Table body | text-sm (14px) | normal | foreground |
| Filter label | text-xs (12px) | font-medium (500) | muted-foreground |
| Chart title | 12–13px | normal | fontColor (theme-aware) |

---

## 3. Shared Component Patterns

### 3.1 Card Container

```
- Background: bg-card
- Border: 1px solid border token (border-border)
- Radius: rounded-lg (8px)
- Padding: p-4 (16px)
```

### 3.2 KPI Card

```
┌─────────────────────────┐
│ [label]    text-sm muted │
│ [value]    text-2xl bold │
│ [delta]    text-sm color │
└─────────────────────────┘
```
- Container: Card pattern (bg-card, border, rounded-lg, p-4)
- Delta color logic: green for favorable, red for unfavorable
- "Invert color" variant for AWS cap (positive = bad)

### 3.3 Data Table

```
┌──────────────────────────────────────┐
│ Header Row  │  bg-primary, text-primary-foreground
├──────────────────────────────────────┤
│ Data Row    │  border-t border-border
│ Data Row    │  
│ Data Row    │  
└──────────────────────────────────────┘
```
- Container: Card with `overflow-hidden` (no padding, rounded corners clip header)
- Header cells: `px-4 py-2`, left-aligned text, right-aligned numbers
- Body cells: `px-4 py-2`
- Full width: `w-full text-sm`

### 3.4 Filter Dropdown

```
┌─────────────────────┐
│ [Label] xs medium   │
│ ┌─────────────────┐ │
│ │ Select ▾        │ │
│ └─────────────────┘ │
└─────────────────────┘
```
- Label: text-xs font-medium text-muted-foreground
- Select: `w-full mt-1 px-2 py-1.5 text-sm bg-background border-border rounded-lg`
- Always includes "All" as first option

### 3.5 Active Filter Pills

```
[ leader: Smith ✕ ] [ type: FTE ✕ ]  Reset All
```
- Pill: `bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full`
- Click to remove individual filter
- "Reset All" link: `text-xs text-muted-foreground underline`

### 3.6 Primary Button

```
- Background: bg-primary
- Text: text-primary-foreground text-sm font-medium
- Padding: px-4 py-2
- Radius: rounded-lg
- Disabled: opacity-50
```

### 3.7 Chart Container

```
┌─────────────────────────────────────┐
│ [Section Title]  text-lg semibold   │
│ [Subtitle/note]  text-xs muted      │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Plotly Chart Area       │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```
- Outer: Card pattern (bg-card, border, rounded-lg, p-4)
- Chart: transparent backgrounds (`paper_bgcolor: rgba(0,0,0,0)`, `plot_bgcolor: rgba(0,0,0,0)`)
- Font color: theme-aware (dark=#fbf9ff, light=#000807)
- Grid color: theme-aware (dark=rgba(162,163,187,0.2), light=rgba(0,8,7,0.08))


---

## 4. Page Specifications

---

### PAGE 1: Executive Summary (`/`)

**Purpose:** High-level financial KPIs, trends, and budget flow visualization for leadership at-a-glance view.

#### 4.1.1 KPI Cards Row

**Layout:** Grid — 1 col mobile, 2 cols tablet (md), 4 cols desktop (lg). Gap: 16px.

| Card # | Title | Value | Delta | Color Logic |
|--------|-------|-------|-------|-------------|
| 1 | Full Year Forecast | `$X,XXX,XXX` | `+$XX,XXX/mo vs actuals` | Green = growth (neutral) |
| 2 | Labor Forecast | `$X,XXX,XXX` | `+$XX,XXX/mo vs actuals` | Green = growth |
| 3 | AWS Forecast | `$XXX,XXX` | `+$XX,XXX/mo vs actuals` | Green = growth |
| 4 | AWS Variance to Cap | `$XXX,XXX` | `OVER CAP` or `Under` | **Inverted**: Red if over, Green if under |

**Data Source:** `GET /data/summary` → `kpis` object.

#### 4.1.2 Monthly Trends (Sparklines)

**Layout:** 2-column grid (md breakpoint), each in a card container.

**Chart Type:** Plotly line chart with markers.

| Chart | Color Scheme |
|-------|-------------|
| Labor Cost ($) | Actuals (Jan–Mar): `#a2a3bb` solid. Forecast (Apr–Dec): `#115fa0` dotted. |
| AWS Cost ($) | Actuals (Jan–Mar): `#a2a3bb` solid. Forecast (Apr–Dec): `#b3b7ee` dotted. |

**Chart Specs:**
- Height: 220px
- Markers: size 5
- Line width: 2
- X-axis: All 12 month abbreviations
- Y-axis: Formatted with commas, auto-range with 30% padding
- Legend: Horizontal, below chart (`y: -0.55`), font size 9
- No title bar — title rendered via `title.text` inside chart at size 12

#### 4.1.3 Top 5 Project Cost Drivers Table

**Layout:** Full-width data table in card container.

| Column | Alignment | Format |
|--------|-----------|--------|
| Project Number | Left | Plain text (e.g., P00003) |
| Project Name | Left | Plain text |
| Full Year Cost | Right | `$X,XXX,XXX` currency |

**Data Source:** `GET /data/projects` → `top5` array.

#### 4.1.4 Sankey Diagram — Budget Flow

**Section Header:** "Budget Flow — Funding BU → Project → Employee Type"

**Chart Type:** Plotly Sankey diagram in a card container.

**Node Layers:**
1. **Left:** Funding Business Units (e.g., Customer Operations, Technology, Product)
2. **Middle:** Top projects by cost
3. **Right:** Employee Types (FTE, Contractor)

**Visual Properties:**
- Node padding: 20, thickness: 20
- Link colors: 40% opacity of the source node's color
- Node colors: Provided by API (FBU-based color coding)
- Height: 500px
- Margins: l:20, r:20, t:10, b:20
- Hover: Shows dollar amount on each link

**Interaction:** Click to highlight a flow path.

**Data Source:** `GET /data/sankey` → nodes, sources, targets, values, colors.


---

### PAGE 2: Resource Forecasting (`/resources`)

**Purpose:** Detailed labor cost analysis with filtering, monthly cost breakdown, project timelines, and budget composition.

#### 4.2.1 Filter Bar

**Layout:** Card container with two zones stacked vertically.

**Zone 1 — Active Filter Pills:** (only visible when filters active)
- Flex row, flex-wrap, gap-2, mb-3
- Each pill shows `key: value ✕` 
- "Reset All" text link at end

**Zone 2 — Filter Dropdowns:**
- Grid: 2 cols mobile, 5 cols desktop (md:grid-cols-5), gap-3

| Filter | API Field | Source |
|--------|-----------|--------|
| Leader | `leader` | `GET /data/roster` → `leaders[]` |
| Type | `type` | `GET /data/roster` → `types[]` |
| Location | `location` | `GET /data/roster` → `locations[]` |
| Funding BU | `fbu` | `GET /data/roster` → `fbus[]` |
| Project | `project` | `GET /data/roster` → `projects[]` |

**Behavior:** Selecting a filter re-fetches labor data with query params. All filters sent as URL params to `GET /data/labor`.

#### 4.2.2 KPI Summary Row

**Layout:** 3-column grid, gap-4.

| KPI | Value |
|-----|-------|
| Total Cost | Sum of all monthly costs |
| Avg Historical / Month | Mean of Jan–Mar costs |
| Avg Forecasted / Month | Mean of Apr–Dec costs |

Uses smaller KPI card variant: `p-4`, `text-xl` value (vs text-2xl on Exec Summary).

#### 4.2.3 Cost and Usage Bar Chart

**Section Header:** "Cost and Usage Graph"  
**Subtitle:** "Jan–Mar: Actuals | Apr–Dec: Forecasted" (text-xs muted)

**Chart Type:** Grouped bar chart.

| Series | Months | Color |
|--------|--------|-------|
| Actuals | Jan, Feb, Mar | Solid `#115fa0` |
| Forecast | Apr–Dec | `rgba(179,183,238,0.4)` fill with `#b3b7ee` 2px border |

**Annotations:**
- Vertical dashed red line at September (`x: 'Sep'`)
- Annotation text "P10/P14 sunset" above the line in red (#dc2626)
- This marks where projects P00010 and P00014 end

**Chart Specs:**
- Height: 380px
- Y-axis: "Costs ($)", comma formatted
- Legend: Horizontal below (`y: -0.2`)
- Barmode: group

#### 4.2.4 Resource Gantt Chart

**Section Header:** "Resource Gantt Chart"

**Legend:** Custom HTML legend above chart — flex-wrap row of colored squares (w-3 h-3 rounded-sm) with FBU labels, text-xs.

**Chart Type:** Plotly scatter with `mode: 'lines'`, line width 20 (creates horizontal bars).

**Visual Properties:**
- Each bar = one project's active timespan
- Color-coded by Funding Business Unit
- Ended projects (P00010, P00014) truncate at August
- Height: Dynamic — `max(400, numProjects × 32)`
- Y-axis: Project names (automargin)
- X-axis: Date type, showing 2026 months
- No built-in Plotly legend (custom HTML above)

#### 4.2.5 Budget Composition Treemap

**Section Header:** "Budget Composition — Treemap"

**Chart Type:** Plotly treemap with `branchvalues: 'remainder'`.

**Hierarchy:**
1. Root level: Funding Business Units
2. Second level: Projects (labeled as "ProjectName - FBU")
3. Leaf level: Employee names (labeled as "EmployeeName (ProjectName)")

**Visual Properties:**
- Height: 500px
- Color scale: `[[0, '#115fa0'], [0.5, '#b3b7ee'], [1, '#a2a3bb']]`
- Text: label + percent of parent
- Hover: `<b>label</b><br>Cost: $X,XXX`
- Margins: 10px all sides
- Interactive: Click to drill into lower levels


---

### PAGE 3: AWS Forecasting (`/aws`)

**Purpose:** AWS cloud cost projections, cap monitoring, account-level breakdowns, and growth trend analysis.

#### 4.3.1 Filters

**Layout:** 2-column grid, gap-4. No card container (bare dropdowns).

| Filter | Type | Behavior |
|--------|------|----------|
| SVP Group | Single-select dropdown | Resets employee selection on change |
| Employees | Multi-select (`<select multiple>`) | Height: 80px (`h-20`). Multiple employees selectable via Ctrl/Cmd+click |

**Data Source:** `GET /data/roster` → `svp_groups[]`, `employees[]`. Employee list filters by SVP selection.

#### 4.3.2 KPI Row

**Layout:** 3-column grid, gap-4.

| KPI | Value | Subtext |
|-----|-------|---------|
| AWS Full Year Forecast | `$X,XXX,XXX` | — |
| Annual Cap | `$2,100,000` | — |
| Variance to Cap | `$XXX,XXX` | "OVER" (red) or "Under" (green) |

#### 4.3.3 Cumulative AWS Spend vs Cap

**Section Header:** "Cumulative AWS Spend vs Cap"

**Chart Type:** Line chart with area fill (`fill: 'tozeroy'`).

**Visual Properties:**
- Line: `#115fa0`, width 2, with markers
- Fill: `rgba(17,95,160,0.15)` — subtle area under curve
- Cap reference line: Horizontal dashed red line at $2,100,000 (`y0: aws_cap`)
- Cap annotation: Left-aligned, "Cap: $2,100,000" in red, slight y-offset
- Height: 380px
- X-axis: 12 months (category order)
- Y-axis: "Cumulative Cost ($)", comma formatted

**Key Behavior:** The shaded area visually builds up month-over-month. If the line crosses the cap, the visual tension is immediately apparent.

#### 4.3.4 Top 5 Cost-Driving Accounts Table

**Section Header:** "Top 5 Cost-Driving Accounts"

| Column | Alignment | Format |
|--------|-----------|--------|
| Account | Left | Account ID (e.g., AWS00008) |
| Employee | Left | Owner/responsible name |
| Forecast | Right | `$XXX,XXX` |
| % of Total | Right | `XX.X%` |

#### 4.3.5 Account Monthly Trends (Line Chart)

**Layout:** Left half of a 2-column grid (md:grid-cols-2).

**Section Header:** "Account Monthly Trends"

**Chart Type:** Multi-line chart, one line per AWS account.

**Visual Properties:**
- Growth accounts (AWS00008, AWS00011, AWS00027): Solid lines
- Non-growth accounts: Dotted lines (`dash: 'dot'`)
- Height: 300px
- Legend: font size 8 (compact, many accounts)
- Shows the 5% MoM growth pattern clearly for growth accounts

#### 4.3.6 Monthly Cost by Account — Stacked Bar

**Layout:** Right half of the 2-column grid.

**Section Header:** "Monthly Cost by Account (Stacked)"

**Chart Type:** Stacked bar chart (`barmode: 'stack'`).

**Visual Properties:**
- Each account = one color segment per month
- Height: 300px
- Legend: font size 8
- Hover shows account number and dollar amount

#### 4.3.7 Forecast Assumptions Card

**Layout:** Card container at bottom of page.

**Section Header:** "Forecast Assumptions"

**Content:** Bulleted list (`list-disc pl-5`) in text-sm text-muted-foreground:
- Growth accounts (AWS00008, AWS00011, AWS00027): 5% month-over-month from March.
- All other accounts: Jan–Mar weighted average applied to Apr–Dec.
- Annual cap monitored at $2,100,000.


---

### PAGE 4: Scenario Planner (`/scenarios`)

**Purpose:** Interactive what-if analysis, per-employee hour editing, and named scenario management for budget planning.

#### 4.4.0 Tab Navigation

**Layout:** Horizontal tab bar with bottom border (`border-b border-border pb-2`). Flex row, gap-2.

| Tab | Label |
|-----|-------|
| `employees` | Employee View |
| `whatif` | What-If Analysis |
| `editor` | Hour Editor |
| `scenarios` | Scenarios |

**Tab States:**
- Active: `bg-primary text-primary-foreground` with rounded-t
- Inactive: `text-muted-foreground`, hover → `text-foreground bg-muted/20`

---

#### 4.4.1 Tab: Employee View

**Purpose:** Drill into individual employee costs, allocation, and monthly breakdown.

**Filters:** 3-column grid with SVP Group, Employee Type, Employee select dropdowns.

**Employee Info Line:** `text-sm muted` — "{Name} — {Type} — ${Rate}/hr"

**KPI Row:** 4-column grid, gap-3. Smaller KPI variant (p-3, text-lg value):

| KPI | Value |
|-----|-------|
| Full Year Cost | `$XXX,XXX` |
| Avg Hrs/Project | Numeric (e.g., 480) |
| Hourly Rate | `$XX/hr` |
| Top Project % | `XX%` (% of cost from highest project) |

**Bar Chart:** Per-employee monthly cost.
- All 12 months on x-axis
- Actuals (Jan–Mar): `#a2a3bb`
- Forecast (Apr–Dec): `#115fa0`
- Height: 280px
- Y-axis: "Cost ($)"

---

#### 4.4.2 Tab: What-If Analysis

**Purpose:** Model employee transfers, project sunsets, and layoffs with instant impact calculation.

**Action Selector:** Radio button group (horizontal flex, gap-4):
- ○ Transfer Employee
- ○ Project Sunset
- ○ Employee Layoff

**Radio style:** `accent-primary`, text-sm, cursor-pointer.

##### Transfer Form
- 2-column grid of dropdowns: Employee, Source Project, Destination Project, Mode (full/partial)
- Conditional: If mode = "partial", show Hours/month number input (`w-32`)
- "Run Analysis" primary button

**Transfer Results Card:**
- Summary line: "Total Hours Transferred: X — Cost Impact: $X"
- Violation warning (red text): "⚠ Source hours go negative in: [months]"
- Results table: Month | Src Before | Src After | Dst Before | Dst After | Moved

##### Sunset Form
- 2-column grid: Project dropdown, Last Active Month dropdown (Apr–Dec)
- "Run Analysis" button
- Results: "Affected: X employees — Total hours freed: X"
- Table: Employee | Hours Freed | Cost Freed | Redistributed To

##### Layoff Form
- 3-column grid: Employee, Effective Month, View Mode (savings/redistribute)
- "Run Analysis" button
- **Savings view:** "Total Savings: $X" + table (Month | Hours Saved | Cost Saved)
- **Redistribute view:** Table (Project | Hours | Receiving | Hrs/Mo | Risk)
  - Risk column: Red text if "Over 160"

---

#### 4.4.3 Tab: Hour Editor

**Purpose:** Direct cell-level editing of employee hour allocations with real-time 160-hour constraint validation.

**Employee Select:** Single dropdown at top.

**Info Line:** "{Name} — ${Rate}/hr"

**Editable Grid:**

| Element | Spec |
|---------|------|
| Container | `overflow-x-auto` for horizontal scroll |
| Header row | `bg-primary text-primary-foreground` |
| Columns | Project (text, left) + 9 forecast months (Apr–Dec) |
| Cell inputs | `w-14 px-1 py-0.5`, number type, border-border, rounded-lg, text-xs |
| Footer row | Bold totals, `border-t-2 border-foreground` |

**Validation:**
- Each month total must = 160.0
- Valid months: `text-emerald-500`
- Invalid months: `text-red-500`
- Warning message below grid: "⚠ Hour constraint violated — months must sum to 160." (text-sm text-red-500 font-medium)

**Cost Impact Card:** Shows total cost = sum(hours) × hourly rate.

---

#### 4.4.4 Tab: Scenarios

**Purpose:** CRUD management for named forecast scenarios.

**Save Form (card container):**
- Header: "Save New Scenario" (font-medium)
- Name input: Full width, placeholder "Scenario name"
- Description input: Full width, placeholder "Description"
- "Save Scenario" button (disabled when name empty → opacity-50)

**Saved Scenarios Table (card container, conditional):**
- Header: "Saved Scenarios"
- Columns: Name (font-medium) | Description (muted) | Created (xs muted, date only) | [Delete button]
- Delete: Red text link "Delete", triggers API call

**API Endpoints:**
- List: `GET /scenarios`
- Create: `POST /scenarios` with `{ name, description, overrides, project_targets }`
- Delete: `DELETE /scenarios/:id`


---

### PAGE 5: AI Insights (`/ai`)

**Purpose:** Rule-based alert monitoring and conversational AI analysis of budget data via OpenAI-powered chat.

#### 4.5.1 Alerts Panel (Collapsible)

**Layout:** Card container with collapsible behavior (click header to expand/collapse).

**Header (always visible):**
- Full-width clickable button
- Left: "Alerts: 🔴 X High · ⚠️ X Med · ℹ️ X Low"
- Right: `▼` (open) or `▶` (closed) in muted text
- Font: font-medium text-foreground

**Expanded Content:**

**Severity Filter:** Radio button row (flex gap-3, text-xs):
- ○ All | ○ High | ○ Medium | ○ Low

**Alert Cards:** Vertical stack, space-y-3.

| Severity | Left Border | Badge Style |
|----------|-------------|-------------|
| Critical/High | `border-l-4 border-l-red-500` | `bg-red-500/20 text-red-400` |
| Warning/Med | `border-l-4 border-l-amber-500` | `bg-amber-500/20 text-amber-400` |
| Info/Low | `border-l-4 border-l-blue-500` | `bg-blue-500/20 text-blue-400` |

**Alert Card Structure:**
```
┌─ 4px colored left border ──────────────────────┐
│ [BADGE] Title (text-sm bold)  (category) xs    │
│ Message text (text-sm muted-foreground, mt-1)  │
└────────────────────────────────────────────────┘
```
- Badge: `px-2 py-0.5 rounded-full text-[10px] font-bold uppercase`
- Background: `bg-card`, padding `p-3`, `rounded-r`

**Data Source:** `GET /ai/insights` → `insights[]` with `{ severity, category, title, message }`.

#### 4.5.2 Preset Prompt Buttons

**Layout:** Grid — 1 col mobile, 3 cols desktop (md:grid-cols-3), gap-3.

**6 Preset Buttons:**

| # | Label |
|---|-------|
| 1 | 🔄 Recommended Changes & Forecasts |
| 2 | 💰 Capital vs. OpEx Breakdown |
| 3 | 👥 Staffing & Capacity Risks |
| 4 | ☁️ AWS Cost Forecast |
| 5 | 📈 Project Investment Mix |
| 6 | 📊 Year-End Budget Summary |

**Button Style:**
- `text-left bg-card border border-border rounded-lg px-4 py-3`
- `text-sm font-medium text-foreground`
- Hover: `border-primary` transition
- Disabled (while loading): `opacity-50`

**Behavior:** Clicking sends the preset's full prompt text to the chat API.

#### 4.5.3 Chat Interface

**Layout:** Card container with no padding (overflow-hidden for clean edges).

**Message Area:**
- Height: 500px fixed (`h-[500px]`)
- `overflow-y-auto`, padding `p-4`, vertical gap `space-y-4`
- Auto-scrolls to bottom on new messages

**Empty State:** Centered text at ~20% from top: "💬 Ask a question using the presets above or type below." (muted)

**Message Bubbles:**

| Role | Alignment | Style |
|------|-----------|-------|
| User | Right (`justify-end`) | `bg-primary text-primary-foreground` rounded-lg px-4 py-2 |
| Assistant | Left (`justify-start`) | `bg-muted/20 border border-border text-foreground` rounded-lg px-4 py-2 |

- Max width: 80% of container
- Content: `<pre>` with `whitespace-pre-wrap font-sans` (preserves formatting)
- Loading state: Pulsing "Analyzing..." bubble on assistant side (`animate-pulse`)

**Input Bar:**
- Separated by `border-t border-border`
- Padding: `p-3`
- Layout: Flex row, gap-2
- Input: `flex-1`, standard input styling, placeholder "Ask a question about your data..."
- Send button: Primary button style, disabled when empty or loading

**API:** `POST /ai/chat` with `{ message, history }` (last 6 messages for context).

---

## 5. Interaction Patterns & State

### 5.1 Data Fetching

| Pattern | Implementation |
|---------|----------------|
| Library | TanStack React Query |
| Caching | Default stale time; prefetch on nav hover (5-min staleTime) |
| Loading state | Simple text "Loading..." in muted color |
| Error handling | Graceful fallback (AI errors shown inline) |

### 5.2 Prefetch Strategy

Hovering or focusing a nav item triggers background fetch of that page's data:

| Page | Prefetched Keys |
|------|-----------------|
| Summary | summary, sankey, projects |
| Resources | labor, roster |
| AWS | aws, roster |
| Scenarios | roster, labor |
| AI Insights | insights |

### 5.3 Theme Persistence

- Theme stored in localStorage
- Toggled via navbar button
- Applied via `class="dark"` on `<html>` element
- All chart colors dynamically computed from theme state

### 5.4 Filter State

- Local component state (React `useState`) within Resource Forecasting page
- Not persisted across page navigation
- Filters sent as URL query params to API

---

## 6. Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Mobile (default) | < 768px | Single column layouts, nav icons only, stacked cards |
| Tablet (md) | ≥ 768px | 2-col grids, nav labels appear, side-by-side charts |
| Desktop (lg) | ≥ 1024px | 3-4 col KPI grids, full chart widths |
| Max container | 1280px | `max-w-7xl` content cap, centered |

---

## 7. Figma Design Notes & Recommendations

### 7.1 Component Library Needed

Build these as reusable Figma components with variants:

1. **KPI Card** — Variants: standard, inverted-color, small (scenarios)
2. **Data Table** — With header row color variant
3. **Filter Dropdown** — With label
4. **Filter Pill** — Active state with dismiss
5. **Primary Button** — Default, disabled, loading
6. **Card Container** — Base wrapper
7. **Alert Card** — 3 severity variants
8. **Chat Bubble** — User, assistant, loading
9. **Tab Bar** — Active/inactive states
10. **Navbar** — With active item + theme toggle

### 7.2 Chart Placeholder Strategy

For Figma mockups, represent Plotly charts as:
- Clearly labeled rectangular areas with chart type noted
- Use the exact color palette tokens defined above
- Include representative sample data shapes (bars, lines, areas)
- Annotate dimensions (height values provided per chart)

### 7.3 Key Visual Priorities

1. **Dark mode parity** — Design both modes; dark is the likely default for analyst use
2. **Information density** — The dashboard is data-heavy; avoid excessive whitespace between cards
3. **Color consistency** — Actuals are always muted/gray; forecasts are always primary blue/purple
4. **Alert severity colors** — Red/Amber/Blue must be instantly distinguishable
5. **The floating navbar** is the signature UI element — ensure it feels premium with blur + shadow

### 7.4 Accessibility Considerations

- Minimum 4.5:1 contrast ratio for text on all backgrounds
- Interactive elements need visible focus states (ring token)
- Chart colors should work for colorblind users (avoid red/green only differentiation — the palette uses blue/purple/gray as primary, red only for alerts)
- All form inputs need associated labels
- Tab navigation should be logical (top-to-bottom, left-to-right)

---

## 8. API Endpoint Reference

| Endpoint | Method | Page(s) | Returns |
|----------|--------|---------|---------|
| `/data/summary` | GET | Executive Summary | KPIs, monthly arrays, months list |
| `/data/sankey` | GET | Executive Summary | Nodes, links, colors for Sankey |
| `/data/projects` | GET | Executive Summary | Top 5 projects by cost |
| `/data/roster` | GET | Resources, AWS, Scenarios | Filter options (leaders, types, etc.) |
| `/data/labor` | GET | Resources, Scenarios | Filtered labor records with costs |
| `/data/aws` | GET | AWS | AWS records, validation, monthly totals |
| `/ai/insights` | GET | AI Insights | Rule-based alert array |
| `/ai/chat` | POST | AI Insights | LLM response to user query |
| `/scenarios` | GET | Scenarios | List all saved scenarios |
| `/scenarios` | POST | Scenarios | Create new scenario |
| `/scenarios/:id` | DELETE | Scenarios | Delete scenario |
| `/scenarios/what-if/transfer` | POST | Scenarios | Transfer simulation results |
| `/scenarios/what-if/sunset` | POST | Scenarios | Sunset simulation results |
| `/scenarios/what-if/layoff` | POST | Scenarios | Layoff simulation results |

---

## 9. File & Asset Summary

| Asset | Purpose |
|-------|---------|
| Material Icons (Rounded) | Navbar icons — imported from `@mui/icons-material` |
| Plotly.js (`react-plotly.js`) | All chart rendering |
| Tailwind CSS | Utility-first styling, all custom tokens in `index.css` |
| System font stack | `system-ui, -apple-system, sans-serif` |

---

*End of Design Specification*
