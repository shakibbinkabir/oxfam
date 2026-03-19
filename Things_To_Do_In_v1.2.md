# Things To Do In v1.2 — CVI Calculation Engine

**Theme:** *The Brain — Build the core intelligence layer that powers everything*
**Priority:** P0 — Critical
**Depends on:** v1.1 (indicator values, boundaries, seed data)
**Unlocks:** v1.3 (score-based map), v1.4 (simulation), v1.5 (exports)

---

## Why This Version Matters

The CVI calculation engine is the **intellectual core** of CRVAP. Without it, the map has no scores to display, the simulation tool has nothing to compute, and exports have no meaningful data. Every downstream feature depends on this version.

---

## Backend Tasks

### 1. Indicator Reference Table (Global Min/Max & Direction)

- [ ] Create new `indicator_reference` table via Alembic migration:
  ```
  id, indicator_id (FK), global_min (float), global_max (float),
  direction (enum: '+' positive, '-' inverted), weight (float, default 1.0),
  updated_at
  ```
- [ ] Add unique constraint on `indicator_id`
- [ ] Write seed script to populate `indicator_reference` from the CVI Excel workbook:
  - Compute `global_min` and `global_max` from all 8,181 union-level records in the `CVI_OXFAM` data sheet
  - Set `direction` from the PRD indicator table ('+' or '-')
  - Default `weight` = 1.0 for all indicators
- [ ] Create API endpoints:
  - `GET /api/v1/indicators/reference` — list all reference entries
  - `PUT /api/v1/indicators/reference/{id}` — admin update (e.g., adjust min/max after new data import)
- [ ] Auto-update global min/max when batch imports extend the range

### 2. CVI Calculation Service

- [ ] Create `app/services/cvi_engine.py` with the following functions:

#### Stage 1 — Min-Max Normalisation
- [ ] `normalise(value, global_min, global_max, direction)` → float [0, 1]
  - For positive direction (`+`): `(value - min) / (max - min)`
  - For inverted direction (`-`): `1 - (value - min) / (max - min)`
  - Handle edge case where `min == max` (return 0.5)
  - Clamp result to [0, 1]

#### Stage 2 — Component Score Aggregation
- [ ] `compute_component_score(normalised_values: list[float])` → float
  - Arithmetic mean of all normalised sub-indicator values within a dimension
  - Return `None` if no values provided
- [ ] Component grouping logic:
  - **Hazard**: rainfall, heat, colddays, drought, water, erosion, surge, salinity, lightning
  - **Socioeconomic Exposure**: population, household, female, child_old
  - **Sensitivity**: pop_density, dependency, disable, unemployed, fm_ratio, vulnerable_hh, hh_size, slum_float, poverty, crop_damage, occupation, edu_hamper, migration
  - **Adaptive Capacity**: literacy, electricity, solar, drink_water, sanitation, handwash, edu_institute, shelter_cov, market_cov, mfs, internet, production, mangrove, cc_awareness, disaster_prep, safety_net, pavedroad
  - **Environmental Exposure**: forest, waterbody, agri_land
  - **Environmental Sensitivity**: ndvi, wetland_loss, groundwater

#### Stage 3 — Vulnerability & CRI
- [ ] `compute_vulnerability(exposure, sensitivity, adaptive_capacity)` → float
  - `Vulnerability = (Exposure + Sensitivity + (1 - Adaptive_Capacity)) / 3`
  - Combine socioeconomic + environmental exposure/sensitivity as per PRD grouping
- [ ] `compute_cri(hazard_score, vulnerability)` → float
  - `CRI = (Hazard + Vulnerability) / 2`
  - Bounded [0, 1]
- [ ] `compute_all_scores(boundary_pcode)` → dict
  - Fetches all indicator values for a boundary
  - Runs the full 3-stage pipeline
  - Returns: `{ hazard, exposure, sensitivity, adaptive_capacity, environmental_exposure, environmental_sensitivity, vulnerability, cri, normalised_values: {...} }`

### 3. Score Computation API Endpoints

- [ ] `GET /api/v1/scores/{boundary_pcode}` — Compute and return full CVI breakdown for a single boundary
  - Response: all component scores, vulnerability, CRI, normalised values, calculation trace
- [ ] `GET /api/v1/scores/` — Compute scores for multiple boundaries (with filters: division, district, upazila, level)
  - Pagination support
  - Used by the map to colour boundaries
- [ ] `GET /api/v1/scores/map?level={1|2|3|4}&indicator={cri|hazard|exposure|...}` — Return GeoJSON FeatureCollection with score properties for choropleth rendering
  - Each feature includes: pcode, name, selected score value, cri, all component scores
  - Support `bbox` filtering for large datasets

### 4. Runtime Aggregation to Higher Admin Levels

- [ ] When scores are requested for a non-union level (division/district/upazila):
  - Compute the spatial average of all constituent union CRI/component scores
  - Weighted by area or simple arithmetic mean (start with arithmetic mean)
- [ ] Cache aggregated scores with invalidation when underlying union data changes

### 5. Score Caching Layer

- [ ] Add `computed_scores` table via migration:
  ```
  id, boundary_pcode (unique), hazard_score, exposure_score,
  sensitivity_score, adaptive_capacity_score, vulnerability_score,
  cri_score, computed_at, is_stale (boolean)
  ```
- [ ] Recompute and cache scores when indicator values are created/updated/deleted
- [ ] Mark scores as stale when dependent data changes; recompute on next read
- [ ] Bulk recompute endpoint: `POST /api/v1/scores/recompute` (admin only)

### 6. Calculation Trace for Transparency

- [ ] `GET /api/v1/scores/{boundary_pcode}/trace` — Return step-by-step calculation:
  - Raw values → normalised values (with min/max/direction used)
  - Normalised values → component averages
  - Component scores → vulnerability → CRI
  - Each step shows the formula applied and intermediate results
- [ ] This powers the "full calculation trace" requirement in the Detail Side Panel

---

## Frontend Tasks

### 7. Score Display in Detail Side Panel

- [ ] Fetch scores from `GET /api/v1/scores/{pcode}` when a boundary is selected
- [ ] Display **CRI Score Card** at top of panel:
  - Large CRI value (0.000 – 1.000)
  - Category label: Very Low (0-0.2), Low (0.2-0.4), Medium (0.4-0.6), High (0.6-0.8), Very High (0.8-1.0)
  - Rank within parent boundary (e.g., "12th of 47 unions in this upazila")
- [ ] Display **5 dimension scores** as horizontal bar charts:
  - Hazard, Exposure, Sensitivity, Adaptive Capacity, Vulnerability
  - Color-coded bars (green → red gradient based on score)
- [ ] Display **normalised values** in expandable raw indicators panel:
  - Show both raw value and normalised score side by side
  - Group by dimension with collapsible sections

### 8. Score API Integration Hook

- [ ] Create `useScores(pcode)` custom hook
- [ ] Create `useMapScores(level, indicator, bbox)` custom hook for choropleth data
- [ ] Handle loading and error states

---

## Testing

- [ ] Unit tests for `normalise()` — positive direction, inverted direction, edge cases (min=max, out-of-range)
- [ ] Unit tests for `compute_component_score()` — normal case, empty list, single value
- [ ] Unit tests for `compute_vulnerability()` and `compute_cri()` — known values from Excel
- [ ] Integration test: seed a union's indicator values from the Excel CVI_OXFAM sheet, compute scores, compare against Excel's expected output
- [ ] API test: `GET /scores/{pcode}` returns correct structure and values
- [ ] API test: `GET /scores/map` returns valid GeoJSON with score properties

---

## Acceptance Criteria

1. Given a union with all 40+ indicator values seeded, the CVI engine produces a CRI score matching (±0.01) the value in the Oxfam CVI Excel workbook.
2. `GET /api/v1/scores/{pcode}` returns hazard, exposure, sensitivity, adaptive_capacity, vulnerability, and cri scores.
3. `GET /api/v1/scores/map?level=4&indicator=cri` returns a GeoJSON FeatureCollection with CRI scores on each feature.
4. The Detail Side Panel shows the CRI score card and dimension bar charts when a boundary is clicked.
5. Inverted indicators (literacy, electricity, etc.) are correctly normalised using `1 - normalised` formula.
6. Aggregation to division/district/upazila level returns the mean of constituent union scores.

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| Backend (engine + API) | 6 major items | High |
| Frontend (panel update) | 2 items | Medium |
| Testing | 6 test suites | Medium |
| **Total** | **14 items** | **High** |

**After v1.2:** The platform has a working CVI computation pipeline — scores are computed, cached, served via API, and displayed in the side panel. This unlocks score-based map colouring (v1.3) and simulation (v1.4).
