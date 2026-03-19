# Things To Do In v1.4 — What-If Simulation Tool

**Theme:** *The Imagination — Enable planners to test policy assumptions with instant scenario modelling*
**Priority:** P0 — Critical
**Depends on:** v1.2 (CVI engine), v1.3 (score-based map, detail panel)
**Unlocks:** Scenario planning, stakeholder presentations, evidence-based policy discussions

---

## Why This Version Matters

The What-If Simulation is a **key strategic differentiator**. It transforms CRVAP from a data viewer into a **decision-support tool** — planners can model interventions (e.g., "What if we increase literacy from 40% to 60%?") and instantly see how CRI changes, **without modifying stored data**.

---

## Backend Tasks

### 1. Simulation API Endpoint

- [ ] `POST /api/v1/simulate` — Run what-if simulation (no database write)
  - **Request body:**
    ```json
    {
      "boundary_pcode": "BD30140602",
      "modified_values": {
        "literacy": 60.0,
        "salinity": 12.0,
        "electricity": 85.0
      },
      "weights": {
        "hazard": 0.25,
        "exposure": 0.25,
        "sensitivity": 0.25,
        "adaptive_capacity": 0.25
      }
    }
    ```
  - `modified_values`: dict of `gis_attribute_id → new_value` (only changed indicators)
  - `weights`: optional custom dimension weights (default equal, must sum to 1.0)
  - **No authentication required** (all logged-in users can simulate)
  - **No database write** — pure computation

- [ ] **Response:**
  ```json
  {
    "boundary_pcode": "BD30140602",
    "boundary_name": "Amtali Union",
    "original_scores": {
      "hazard": 0.72, "exposure": 0.58, "sensitivity": 0.65,
      "adaptive_capacity": 0.34, "vulnerability": 0.63, "cri": 0.675
    },
    "simulated_scores": {
      "hazard": 0.72, "exposure": 0.58, "sensitivity": 0.65,
      "adaptive_capacity": 0.51, "vulnerability": 0.57, "cri": 0.645
    },
    "deltas": {
      "hazard": 0.0, "exposure": 0.0, "sensitivity": 0.0,
      "adaptive_capacity": +0.17, "vulnerability": -0.06, "cri": -0.03
    },
    "modified_indicators": [
      {
        "code": "literacy",
        "name": "Literacy Rate",
        "original_value": 40.0,
        "simulated_value": 60.0,
        "original_normalised": 0.35,
        "simulated_normalised": 0.52
      }
    ]
  }
  ```

- [ ] Validation:
  - `boundary_pcode` must exist and have indicator data
  - `modified_values` keys must match valid `gis_attribute_id` codes
  - Values must be within plausible ranges (warn, don't reject)
  - Weights must sum to 1.0 (±0.01 tolerance)

### 2. Simulation with Custom Weighting

- [ ] When `weights` are provided, replace equal-weight aggregation:
  - `Weighted_Vulnerability = w_e * Exposure + w_s * Sensitivity + w_a * (1 - AC)`
  - `Weighted_CRI = w_h * Hazard + (1 - w_h) * Weighted_Vulnerability`
- [ ] When `weights` are omitted, use default equal weights (same as standard CVI pipeline)
- [ ] Return both `default_weights` and `custom_weights` in response for transparency

### 3. Save Scenario (Admin Only)

- [ ] Create `scenarios` table via migration:
  ```
  id (UUID), name (string), description (text),
  boundary_pcode (string), modified_values (JSONB),
  weights (JSONB, nullable), original_cri (float), simulated_cri (float),
  created_by (FK users), created_at, is_deleted (boolean, default false)
  ```
- [ ] `POST /api/v1/scenarios` — Save a simulation as a named scenario (admin only)
- [ ] `GET /api/v1/scenarios` — List saved scenarios (all users, with filters)
- [ ] `GET /api/v1/scenarios/{id}` — Get scenario detail
- [ ] `DELETE /api/v1/scenarios/{id}` — Soft-delete scenario (admin only)

---

## Frontend Tasks

### 4. Simulation Modal UI

- [ ] **Floating modal** (centered, 800px wide, scrollable, dismissible)
- [ ] **Header:** "What-If Simulation" + boundary name + close button
- [ ] **Layout:** Two-column on desktop, single column on mobile

#### Left Column — Input
- [ ] **Boundary selector** dropdown (pre-populated if opened from Detail Side Panel)
- [ ] **Indicator fields** grouped by dimension (collapsible sections):
  - Hazard (9 fields)
  - Socioeconomic Exposure (4 fields)
  - Sensitivity (13 fields)
  - Adaptive Capacity (17 fields)
  - Environmental (6 fields)
- [ ] Each field shows:
  - Label + unit hint
  - Current stored value (read-only reference)
  - Editable input (pre-populated with current value)
  - Visual indicator when value differs from stored (highlight border, show delta)
- [ ] **Weight sliders** (optional, expandable section):
  - 4 sliders for Hazard, Exposure, Sensitivity, Adaptive Capacity
  - Values 0.0–1.0, must sum to 1.0
  - Auto-adjust others when one changes (proportional redistribution)
  - "Reset to equal" button
- [ ] **"Run Simulation" button** (primary, disabled until at least one value is modified)
- [ ] **"Reset All" button** (secondary) — restore all fields to stored values

#### Right Column — Results
- [ ] Initially shows placeholder: "Modify values and click Run Simulation"
- [ ] After simulation:
  - **Side-by-side comparison cards:**
    - Original CRI → Simulated CRI (with arrow and colour change)
    - Delta shown as absolute and percentage
  - **Dimension comparison bars:**
    - 5 pairs of bars (original vs simulated) for each dimension
    - Original: solid colour, Simulated: striped/hatched
    - Delta labels (+0.05 / -0.12)
  - **Modified indicators table:**
    - Only indicators that were changed
    - Columns: Indicator, Original, Simulated, Normalised Original, Normalised Simulated
  - **Category change alert:**
    - If CRI category changes (e.g., "High" → "Medium"), show prominent alert

### 5. Simulation → Map Integration

- [ ] After "Run Simulation":
  - Map zooms to the simulated boundary
  - Simulated boundary rendered with **dashed outline** and **simulated CRI colour**
  - Original boundaries keep their standard styling
  - Legend shows a "Simulated" marker
- [ ] **"Reset" button** in modal:
  - Removes dashed overlay from map
  - Restores original boundary styling
  - Clears all modified values

### 6. Save Scenario Flow (Admin Only)

- [ ] After running simulation, show "Save as Scenario" button (admin only)
- [ ] On click: modal within modal (or inline form) asking:
  - Scenario name (required)
  - Description (optional)
- [ ] Calls `POST /api/v1/scenarios` with simulation parameters
- [ ] Toast notification on success
- [ ] Saved scenarios accessible from a "Scenarios" menu item (sidebar)

### 7. Wire "Simulate This Area" Button

- [ ] Connect the button added in v1.3 Detail Side Panel
- [ ] On click:
  - Open Simulation Modal
  - Pre-populate boundary selector with the selected area's pcode
  - Auto-fetch and populate all indicator values for that boundary
- [ ] Loading state while fetching indicator values

### 8. Scenarios List Page (Optional for v1.4)

- [ ] New route: `/dashboard/scenarios`
- [ ] Sidebar menu item: "Scenarios" (visible to all users)
- [ ] TanStack table listing saved scenarios:
  - Columns: Name, Boundary, Original CRI, Simulated CRI, Delta, Created By, Date
  - Click row → open simulation modal pre-loaded with scenario parameters
  - Admin: Delete action
- [ ] Search and filter by boundary

---

## Testing

- [ ] Unit test: `POST /api/v1/simulate` with known inputs matches expected output
- [ ] Unit test: Custom weights produce correct weighted CRI
- [ ] Unit test: Validation rejects invalid boundary_pcode, bad weight sums
- [ ] Integration test: Simulation with single modified indicator returns correct delta
- [ ] Integration test: Simulation with all defaults returns scores matching standard CVI
- [ ] Frontend test: Modal opens pre-populated from Detail Side Panel
- [ ] Frontend test: "Run Simulation" calls API and displays comparison
- [ ] API test: `POST /api/v1/scenarios` saves and `GET` retrieves correctly

---

## Acceptance Criteria

1. User clicks "Simulate This Area" → modal opens with all 40+ indicators pre-populated with stored values.
2. User modifies indicator values → "Run Simulation" sends to backend → side-by-side comparison shows original vs simulated scores.
3. Map zooms to simulated boundary with dashed outline coloured by simulated CRI.
4. "Reset" removes all simulation state (modal fields + map overlay).
5. Custom weight sliders adjust the CRI formula and results update accordingly.
6. Admin can save simulation as a named scenario; all users can view saved scenarios.
7. No data is persisted to `indicator_values` during simulation — purely computational.

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| Backend (simulate API + scenarios) | 3 major items | Medium-High |
| Frontend (modal UI) | 5 items | High |
| Testing | 8 tests | Medium |
| **Total** | **16 items** | **High** |

**After v1.4:** Planners can model interventions and instantly visualise impact. The platform becomes a genuine decision-support tool, fulfilling the PRD's strategic goal of "what-if simulation without modifying stored data."
