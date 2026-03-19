# Things To Do In v1.3 — Score-Based Map & Dashboard

**Theme:** *The Eyes — Transform the map from a boundary viewer into a climate risk intelligence dashboard*
**Priority:** P0 — Critical
**Depends on:** v1.2 (CVI calculation engine, score API)
**Unlocks:** v1.4 (simulation map overlay)

---

## Why This Version Matters

The choropleth map coloured by CVI scores is the **primary user-facing deliverable** — the first thing every stakeholder sees. Currently the map colours by division (static). After v1.3, it becomes a dynamic risk intelligence tool that answers "Where is risk highest and why?" at a glance.

---

## Map Overhaul

### 1. Score-Based Choropleth Colouring

- [ ] Replace division-based static colouring with **5-class sequential colour scale**:
  - Very Low (0.0–0.2): `#2ECC71` (green)
  - Low (0.2–0.4): `#F1C40F` (yellow)
  - Medium (0.4–0.6): `#E67E22` (orange)
  - High (0.6–0.8): `#E74C3C` (red)
  - Very High (0.8–1.0): `#8B0000` (dark red)
- [ ] Fetch scores from `GET /api/v1/scores/map?level={level}&indicator={indicator}`
- [ ] Compute quantile breaks from the score distribution (not fixed thresholds — adapt to data)
- [ ] Apply fill colour + opacity based on score value
- [ ] Boundaries with no data: light grey with hatching pattern

### 2. Indicator Selector

- [ ] Add floating dropdown/button group above the map to switch the active score layer:
  - **CRI** (default) — Climate Risk Index
  - **Hazard** — Hazard Score
  - **Exposure** — Exposure Score
  - **Sensitivity** — Sensitivity Score
  - **Adaptive Capacity** — Adaptive Capacity Score
  - **Vulnerability** — Vulnerability Score
- [ ] On change: re-fetch scores with `indicator` param, re-colour all boundaries
- [ ] Highlight the active selection
- [ ] Persist selection in component state (reset on page load)

### 3. Dynamic Legend

- [ ] Replace division-colour legend with a **score-based gradient legend**:
  - Shows the 5 colour classes with value ranges
  - Updates when indicator selector changes (label changes to match selected indicator)
  - Position: bottom-left corner of map
- [ ] Display the active indicator name in the legend title

### 4. Enhanced Hover Tooltip

- [ ] Update tooltip to show:
  - Area name (English) — bilingual deferred to v1.6
  - Active indicator score (formatted to 3 decimal places)
  - Rank within parent boundary (e.g., "Rank 5 of 47")
  - Category label (Very Low / Low / Medium / High / Very High)
- [ ] Tooltip styling: semi-transparent dark background, white text, rounded corners

### 5. Double-Click Drill-Down

- [ ] On double-click of a boundary polygon:
  - If currently at Division level → zoom into that division, load District boundaries
  - If at District level → zoom into district, load Upazila boundaries
  - If at Upazila level → zoom into upazila, load Union boundaries
  - If at Union level → open Detail Side Panel (already single-click behaviour)
- [ ] Add "Back" / "Zoom Out" button to navigate up one level
- [ ] Maintain indicator selection across drill-down levels

### 6. Layer Controls

- [ ] Add floating control for base tile switching:
  - OpenStreetMap (default)
  - Satellite imagery (Mapbox or ESRI)
  - Simple/minimal base (CartoDB light)
- [ ] Tile layer toggle button in top-right corner of map

---

## KPI Summary Bar

### 7. Summary Statistics Bar

- [ ] Add a 60px-height bar above the map (full width) displaying:
  - **Highest Risk Area**: Name + CRI score of the boundary with the highest CRI at current admin level
  - **Average CRI**: Mean CRI across all visible boundaries
  - **Population at Risk**: Count/estimate of population in boundaries where CRI > 0.6
  - **Data Coverage**: Percentage of boundaries at current level that have complete indicator data
- [ ] Create backend endpoint: `GET /api/v1/scores/summary?level={level}` returning:
  ```json
  {
    "highest_risk": { "name": "...", "pcode": "...", "cri": 0.89 },
    "average_cri": 0.52,
    "population_at_risk": 12450000,
    "total_boundaries": 5160,
    "boundaries_with_data": 4800,
    "data_coverage_pct": 93.0
  }
  ```
- [ ] KPI values update when:
  - Admin level changes (drill-down)
  - Indicator selector changes
  - Map viewport changes (if filtering by bbox)
- [ ] Responsive: stack vertically on smaller screens

---

## Detail Side Panel Enhancements

### 8. Panel Header Improvements

- [ ] Add location breadcrumb: `Division > District > Upazila > Union`
- [ ] Each breadcrumb segment is clickable → zooms map to that level
- [ ] Show area in km²

### 9. CRI Score Card (Enhanced)

- [ ] Large CRI value with 2 decimal places, colour-coded background matching choropleth
- [ ] Category label badge (Very Low → Very High)
- [ ] Rank: "Ranked X of Y within [parent name]"
- [ ] Trend arrow (if historical data exists — placeholder for now)

### 10. Dimension Score Breakdown

- [ ] 5 horizontal bar charts (one per dimension):
  - Hazard Score
  - Exposure Score
  - Sensitivity Score
  - Adaptive Capacity Score
  - Vulnerability Score
- [ ] Each bar:
  - Filled width proportional to score (0–1 scale)
  - Colour matches the 5-class scale
  - Score value label at the end of the bar
- [ ] Expandable sub-sections showing individual normalised indicator values within each dimension

### 11. "Simulate This Area" Button

- [ ] Add button at the bottom of the Detail Side Panel
- [ ] Disabled with tooltip "Coming in v1.4" until simulation is implemented
- [ ] Wired to open simulation modal in v1.4

---

## Frontend Architecture

### 12. Map State Management

- [ ] Create `useMapState` hook or context to manage:
  - Current admin level (1-4)
  - Active indicator (cri/hazard/exposure/sensitivity/adaptive_capacity/vulnerability)
  - Selected boundary pcode
  - Drill-down history stack (for back navigation)
- [ ] All map-dependent components (legend, KPI bar, tooltip, panel) react to state changes

### 13. Performance Optimisation

- [ ] Cache score GeoJSON responses in memory (invalidate on indicator change)
- [ ] Debounce map viewport changes (already have useDebounce)
- [ ] Use `useMemo` for colour computation on large feature sets
- [ ] Lazy-load union-level GeoJSON only within current viewport (bbox filtering)

---

## Testing

- [ ] Visual test: Division-level map renders with correct 5-class colouring
- [ ] Visual test: Switching indicator selector re-colours the map
- [ ] Visual test: KPI bar shows correct statistics
- [ ] Integration test: Double-click drill-down loads correct child boundaries
- [ ] Integration test: Tooltip shows score and rank
- [ ] API test: `GET /api/v1/scores/summary` returns correct aggregates

---

## Acceptance Criteria

1. The map displays boundaries coloured by CRI score using a green-to-dark-red 5-class scale.
2. Users can switch between 6 score layers (CRI, Hazard, Exposure, Sensitivity, AC, Vulnerability) and the map re-colours instantly.
3. Hovering a boundary shows: area name, score, rank, and category label.
4. Double-clicking a boundary drills down one admin level.
5. The KPI Summary Bar shows highest risk area, average CRI, population at risk, and data coverage.
6. The Detail Side Panel shows CRI score card and 5 dimension bar charts.
7. A dynamic legend reflects the current indicator and colour scale.

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| Map components | 6 items | High |
| KPI bar (frontend + API) | 1 item | Medium |
| Side panel enhancements | 4 items | Medium |
| State management | 2 items | Medium |
| Testing | 6 tests | Medium |
| **Total** | **19 items** | **High** |

**After v1.3:** The platform looks and behaves like the PRD vision — a dynamic climate risk intelligence dashboard with interactive choropleth mapping, score breakdowns, and multi-dimensional exploration.
