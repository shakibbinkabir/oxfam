**PRODUCT REQUIREMENT DOCUMENT**

# **Climate Risk & Vulnerability Assessment Platform**

*CRVAP — Version 1.0*

| Project | Interactive Knowledge Hub — Climate Finance Availing & Disbursement Toolkit (CFADT) |
| :---- | :---- |
| **Client** | Oxfam in Bangladesh (OiBD) |
| **Thematic Area** | Climate Justice and Natural Resource Rights (CJNRR) |
| **Document Type** | Software / Product Requirement Document (PRD) |
| **Version** | 1.0 — Initial Release |
| **Prepared By** | Product Manager & System Architect |
| **Date** | March 2026 |
| **Status** | APPROVED FOR DEVELOPMENT |

**STRICTLY CONFIDENTIAL**

*This document contains proprietary information. Reproduction or distribution requires written consent.*

1. # **Executive Summary**

The Climate Risk & Vulnerability Assessment Platform (CRVAP) is a web-based geospatial decision-support system commissioned by Oxfam in Bangladesh under its Climate Justice and Natural Resource Rights (CJNRR) programme. The platform operationalises the Climate Vulnerability Index (CVI) by exposing its calculation engine through an interactive map interface, enabling planners, government officials, civil-society organisations, and donors to explore, simulate, and understand climate risk across Bangladesh's administrative hierarchy.

CRVAP is a risk intelligence and simulation engine — not a fund-disbursement tool. Its central purpose is to translate multi-dimensional vulnerability data into spatially explicit, dynamically calculable outputs that support evidence-based decision-making.

2. # **Problem Statement**

Despite a decade of national climate-data collection in Bangladesh — spanning earth-observation hazard data, socioeconomic surveys, and environmental monitoring — the resulting CVI scores remain trapped in spreadsheets and GIS files inaccessible to non-specialist stakeholders. CRVAP closes this gap by building a dynamic, publicly navigable front-end over the CVI dataset.

3. # **Strategic Goals**

   * Expose the full CVI calculation pipeline (Hazard, Exposure, Sensitivity, Adaptive Capacity, Vulnerability, CRI) in a transparent, auditable web interface.

     * Enable instant what-if simulation without modifying stored data, so planners can test policy assumptions.

     * Support bilingual (English / Bangla) access for inclusion of local government and community users.

     * Maintain a clean CRUD API for Risk Index data management, allowing the CVI dataset to grow over time.

     * Enforce role-based access control (RBAC) ensuring data integrity while enabling broad read access.

     * Deliver a deployment-ready Docker image with full source code, documentation, and a sustainability plan.

   4. # **Scope**

**In scope:** Risk Index CRUD, administrative location chain (Division to District/Upazila to Union), batch data upload, CVI computation engine, interactive choropleth map, detail side-panel, what-if simulation, RBAC, bilingual UI, export (CSV/PDF/Shapefile), Docker deployment.

**Out of scope:** Fund allocation, disbursement workflows, payment tracking, donor portal, mobile app, and real-time remote-sensing ingestion pipelines.

CRVAP serves four distinct user types, each with different access levels and usage patterns.

**Persona 1 — System Administrator (Admin)**

| Role | System Administrator |
| :---- | :---- |
| **RBAC Role** | admin |
| **Technical Level** | High |
| **Primary Goal** | Manage the full CVI dataset, configure indicators, manage users, maintain system health |
| **Key Tasks** | CRUD on all Risk Indices; user management; batch upload; system configuration; audit log review |
| **Success Metric** | Data update time reduced from days to minutes; zero data-integrity incidents |

**Persona 2 — General User (Analyst / Planner)**

| Role | Climate Analyst, Programme Officer, Government Planner |
| :---- | :---- |
| **RBAC Role** | general\_user |
| **Technical Level** | Medium (comfortable with GIS viewers) |
| **Primary Goal** | Explore CVI scores on a map, drill into data, run what-if scenarios |
| **Key Tasks** | Browse map; click boundary to view CVI breakdown; run simulation; export reports |
| **Success Metric** | Can answer a spatial risk question in under 3 minutes without assistance |

**Persona 3 — Read-Only Stakeholder (Donor / Researcher)**

| Role | Donor representative, Researcher, UN/INGO observer |
| :---- | :---- |
| **RBAC Role** | general\_user (read-only) |
| **Technical Level** | Low to medium |
| **Primary Goal** | Understand spatial vulnerability patterns; download data for external reporting |
| **Success Metric** | Can self-serve vulnerability data without requesting it from Oxfam staff |

**Persona 4 — Local Government Officer**

| Role | Union Parishad Chairman, Upazila Nirbahi Officer (UNO) |
| :---- | :---- |
| **RBAC Role** | general\_user |
| **Technical Level** | Low (may use only Bangla UI) |
| **Primary Goal** | Understand their area risk score; participate in planning discussions |
| **Success Metric** | Can view and explain their area CVI score in Bangla without assistance |

1. # **Administrative Location Chain**

Bangladesh's administrative hierarchy governs all data, maps, and calculations. The platform enforces a strict chain pre-seeded from official BBS and LGED boundary data:

	**Division** → **District / Upazila** → **Union / Ward**	

Every Risk Index record must be tagged to a terminal node (Union or Ward). Aggregation to higher levels is computed automatically at runtime as the spatial average of constituent unions.

2. # **Risk Index Management (CRUD)**

The Risk Index is the atomic data unit of CRVAP — a single measured indicator value for a specific Union at a specific time point. The CVI spreadsheet analysis reveals 40+ sub-indicators grouped into five composite dimensions.

1. ## **Create**

   * The input form presents a hierarchical location picker (Division to District to Upazila to Union).

     * Each of the 40+ sub-indicators is presented as a labelled numeric field with unit hint, source reference, and validation range.

       * Fields are grouped by dimension: Hazard, Socioeconomic Exposure, Sensitivity, Adaptive Capacity, Environmental.

       * Upon submission, the system validates completeness and range-checks each value against global min/max from the seed dataset.

       * A confirmation modal shows the computed normalised scores and composite CVI before final save.

     2. ## **Read**

        * Admins and General Users may list all Risk Index records with filters: Division, District, Upazila, Union, Year.

        * Detail view shows the full calculation trace (each formula step) for transparency and auditability.

     3. ## **Update**

        * Only Admins may edit existing records. All edits are versioned; previous values are preserved in audit history.

        * On save, the calculation pipeline re-runs automatically and the map updates via WebSocket push.

     4. ## **Delete (Soft-Delete)**

        * Only Admins may delete records. Deletion is logical (is\_deleted \= true); data is always preserved.

        * Admins may restore soft-deleted records. Hard-delete is not exposed through the UI.

   3. # **Batch Uploader**

Enables bulk import of Risk Index data from CSV or Excel files. The process: (1) Admin uploads file. (2) System parses and displays preview with column mapping suggestions. (3) Admin confirms column-to-indicator mappings using GIS attribute IDs. (4) System validates rows — location integrity, type checks, range checks. (5) A validation summary shows valid/error row counts with downloadable error report. (6) Admin confirms and all

valid rows are inserted and processed. A job-status panel shows real-time progress for large uploads (\>500 rows).

4. # **Interactive Map & Dashboard**

The Dashboard combines a full-screen administrative boundary map with a collapsible side panel and a floating simulation tool.

| Feature | Description |
| :---- | :---- |
| Choropleth Map | OpenLayers 8 with OpenStreetMap / Mapbox base tiles. Boundaries as GeoJSON at Division, Upazila, Union levels. |
| Colour Scale | 5-class sequential (green to dark red) from quantile breaks of displayed scores. |
| Hover Tooltip | Area name (bilingual), CRI score, rank within parent boundary. |
| Click Action | Zoom to boundary extent; open Detail Side Panel. |
| Double Click | Drill down one administrative level. |
| Indicator Selector | Switch active score layer: CRI, Hazard, Exposure, Sensitivity, Adaptive Capacity. |
| KPI Summary Bar | Highest risk area, average CRI, population at risk (CRI\>0.6), data coverage. |

1. ## **Detail Side Panel**

   * Slides in from the right (300px wide). Header: area name (bilingual) with location breadcrumb.

     * CVI Score Card: large CRI value (0-1), category label, rank within parent boundary.

       * Score breakdown: five dimension scores as horizontal bar charts.

       * Raw indicators panel (expandable): all 40+ raw values with label, unit, source, normalised score.

       * Export actions: Download PDF report; download CSV of all raw indicator values.

       * "Simulate This Area" button opens the Simulation Tool pre-loaded with area data.

     2. ## **What-If Simulation Tool**

A floating modal allowing users to manually override indicator values and instantly see score changes without persisting any data. Workflow:

1. User selects a boundary (pre-loaded from Detail Side Panel or chosen from dropdown).

2. Modal pre-populates all 40+ indicator fields with stored real values.

3. User modifies values (e.g., increases salinity from 7.1 to 12.0 to model future intrusion).

4. User clicks "Run Simulation".

5. Frontend sends modified values to POST /api/simulate (no database write).

6. Backend applies the full CVI pipeline to modified inputs and returns all scores.

7. Modal shows side-by-side comparison: original vs. simulated scores for all dimensions and CRI.

8. Map zooms to the simulated boundary and colours it with simulated CRI score (dashed outline).

9. "Reset" restores original values. "Save as Scenario" (Admin only) persists as a named overlay.

1. # **Technology Stack**

| Backend | Python 3.11+ / FastAPI (async ASGI) |
| :---- | :---- |
| **Frontend** | JavaScript ES2022 / ReactJS 18 \+ Vite |
| **Database** | PostgreSQL 15 \+ PostGIS 3.4 extension |
| **Map Engine** | OpenLayers 8 \+ OpenStreetMap / Mapbox tiles |
| **Task Queue** | Celery \+ Redis (async batch processing) |
| **Containerisation** | Docker 24 \+ Docker Compose |
| **Reverse Proxy** | Nginx 1.25 (SSL termination, static serving) |
| **Authentication** | JWT (OAuth2 bearer token via FastAPI-Security) |
| **API Docs** | Swagger UI (auto-generated from FastAPI OpenAPI schema) |
| **Export Engine** | ReportLab (PDF), Pandas (CSV), Fiona+Shapely (Shapefile) |

   2. **CVI Calculation Methodology**

Derived directly from the INDICATORS sheet of the Oxfam CVI Excel workbook. The pipeline has three stages.

1. ## **Stage 1 — Min-Max Normalisation**

Every raw indicator is normalised to \[0, 1\] against the global minimum and maximum across all 8,181 union-level records in the CVI dataset:

For inverted indicators (higher value \= lower vulnerability: Literacy Rate, Electricity Coverage, Drinking Water Access, Sanitation, etc.), the formula inverts:

Global\_Min and Global\_Max are pre-computed from the seed dataset, stored in indicator\_reference, and updated when batch imports extend the global range.

2. ## **Stage 2 — Component Score Aggregation**

Normalised sub-indicator scores within each dimension are averaged (arithmetic mean, equal weighting by default):

3. ## **Stage 3 — Vulnerability & Climate Risk Index (CRI)**

Mirrors the IPCC AR5 risk framework: Risk \= f(Hazard, Vulnerability):

 **Vulnerability \= ( Exposure\_Score \+ Sensitivity\_Score \+ (1 \- Adaptive\_Capacity\_Score) ) / 3** 

	**CRI (Climate Risk Index) \= ( Hazard\_Score \+ Vulnerability ) / 2**	

CRI is bounded \[0, 1\]. Values near 1 indicate extremely high climate risk.

4. ## **Simulation Mode — Custom Weighting**

When users provide custom weights (w\_h, w\_e, w\_s, w\_a summing to 1.0) in the simulation modal:

3. # **API Endpoint Catalogue**

| Method | Endpoint | Actor | Description |
| :---- | :---- | :---- | :---- |
| GET | /api/location/divisions | All | List all divisions |
| GET | /api/location/unions?upazila\_id= | All | List unions by upazila |
| GET | /api/risk-index/ | All | List Risk Index records with filters |
| POST | /api/risk-index/ | Admin/User | Create new Risk Index record |
| GET | /api/risk-index/{id} | All | Get record with full calculation trace |
| PUT | /api/risk-index/{id} | Admin | Update record (creates audit version) |
| DELETE | /api/risk-index/{id} | Admin | Soft-delete a record |
| POST | /api/batch-upload/ | Admin | Upload CSV/XLSX for batch processing |
| GET | /api/batch-upload/{job\_id}/status | Admin | Check async batch job status |
| POST | /api/simulate/ | All | Run what-if simulation (no persistence) |
| GET | /api/map/geojson?level=\&score;= | All | Fetch choropleth GeoJSON by admin level |
| GET | /api/export/csv | All | Export filtered data as CSV |
| GET | /api/export/pdf?union\_id= | All | Export area report as PDF |
| GET | /api/export/shapefile | Admin | Export as Shapefile (GIS format) |
| POST | /api/auth/token | All | Authenticate and obtain JWT access token |
| POST | /api/auth/refresh | All | Refresh JWT using refresh token |

1. **Design Principles**

   * Clarity first: Every screen should answer "Where is risk highest and why?" within three clicks.

     * Bilingual parity: English and Bangla are equal first-class citizens. Font: Noto Sans Bengali for Bangla. Toggle via persistent language switcher in top navigation.

     * Accessibility: WCAG 2.1 AA compliance. Minimum contrast ratio 4.5:1. Keyboard-navigable map controls.

     * Responsive: Fully functional at 1280x720 minimum. Map collapses on mobile; side panel becomes full-screen drawer.

     * Performance: Initial dashboard load under 3 seconds on 10 Mbps. Map tile caching via Nginx.

   2. # **Dashboard Layout**

	**\[ Summary KPI Bar — 60px height, full width \]**	

	**\[ Map Panel 70% viewport \] | \[ Side Panel 30% width, slides in on click \]**	

  **\[ Layer Control \] \[ Indicator Selector \] \[ Legend \] \[ Zoom Controls \] — floating on map**	

3. # **Map Interaction Behaviour**

| User Action | System Response |
| :---- | :---- |
| Hover polygon | Tooltip: area name (bilingual), CRI score, rank within parent |
| Single click | Zoom to boundary; open Detail Side Panel with full score breakdown |
| Double click | Drill down one administrative level |
| Change indicator | Re-colour map; update legend |
| Simulate This Area button | Open Simulation Modal pre-loaded with area data |
| Run Simulation | Send values to backend; update scores; zoom to boundary with dashed overlay |
| Reset in simulation | Restore original values; remove dashed overlay |
| Export PDF | Trigger PDF generation; auto-download |

   4. **Data Entry Form — Multi-Step Wizard**

Step 1: Location: Cascading dropdowns: Division, District, Upazila, Union.

Step 2: Hazard Indicators: 9 fields (rainfall, heat, colddays, drought, water, erosion, surge, salinity, lightning). Step 3: Socioeconomic Data: Exposure (4) \+ Sensitivity (13) \+ Adaptive Capacity (17) fields.  
Step 4: Environmental Data: Exposure (3) \+ Sensitivity (3) \+ Adaptive Capacity (5) fields.

Step 5: Review & Submit: Summary of all values, preview of computed CVI scores, confirmation, submit.

1. # **RBAC Matrix**

| Feature / Action | Admin | General User | Unauthenticated |
| :---- | :---- | :---- | :---- |
| View Dashboard (Map) | Yes | Yes | No |
| View Detail Side Panel | Yes | Yes | No |
| Run What-If Simulation | Yes | Yes | No |
| Export CSV / PDF | Yes | Yes | No |
| Export Shapefile | Yes | No | No |
| Create Risk Index Record | Yes | Yes | No |
| Edit Risk Index Record | Yes | No | No |
| Soft-Delete Record | Yes | No | No |
| Batch Upload | Yes | No | No |
| Manage Users | Yes | No | No |
| View Audit Log | Yes | No | No |
| Configure Indicator Reference | Yes | No | No |
| Save Simulation as Scenario | Yes | No | No |

   2. **Authentication Flow**

1. User submits username \+ password to POST /api/auth/token.

2. Backend validates credentials (bcrypt hashed, min cost factor 12).

3. On success: access\_token (15-min expiry) \+ refresh\_token (7-day expiry, HTTP-only cookie).

4. React stores access\_token in memory only (never localStorage). All requests include Bearer token.

5. On 401 response, frontend automatically attempts token refresh.

6. If refresh fails, user is redirected to login page.

   3. # **Security Controls**

| HTTPS / TLS | All traffic via TLS 1.3. Nginx terminates SSL with Lets Encrypt. HTTP to HTTPS redirect enforced. |
| :---- | :---- |
| **CORS Policy** | Strict CORS: only registered frontend origin allowed. No wildcard origins. |
| **SQL Injection** | All DB access via SQLAlchemy ORM with parameterised queries. |
| **Input Validation** | Pydantic models enforce strict type checking, length limits, and value ranges on every endpoint. |
| **Rate Limiting** | Nginx: 60 req/min per IP for API; 10 req/min for auth endpoints. |
| **Audit Logging** | All write operations logged: user\_id, action, entity, timestamp, IP, changed\_values (JSON diff). |
| **Deployment Security** | Non-root containers; Docker secrets for passwords; PostgreSQL on internal network only. |
| **Backups** | Daily automated pg\_dump to encrypted object storage, retained 30 days. |

All 40+ indicators from the Oxfam CVI dataset, confirmed from the INDICATORS sheet of the uploaded Excel workbook. GIS Attribute IDs match column names in the CVI\_OXFAM data sheet.

| Dimension | Indicator | GIS Attribute ID | Unit | Source | Dir. |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Hazard | Rainfall Risk Index | rainfall | Index | BAMIS/DAE | \+ |
| Hazard | Heat Index | heat | degC | NEX-GDDP | \+ |
| Hazard | Number of Cold Days | colddays | Intensity | BAMIS/DAE | \+ |
| Hazard | Drought Intensity | drought | Category | BARC | \+ |
| Hazard | Water Occurrence (Flood) | water | % | JRC-EC | \+ |
| Hazard | Eroded Area | erosion | % | BARC | \+ |
| Hazard | Storm Surge Inundation Depth | surge | m | MRVAM | \+ |
| Hazard | Salinity Concentration | salinity | ppt | CEGIS | \+ |
| Hazard | Lightning Severity | lightning | No. | BMD | \+ |
| Soc. Exposure | Population | population | No. | BBS | \+ |
| Soc. Exposure | Number of Households | household | No. | BBS | \+ |
| Soc. Exposure | Female Population | female | No. | BBS | \+ |
| Soc. Exposure | Children & Elderly | child\_old | No. | BBS | \+ |
| Sensitivity | Population Density | pop\_density | Pop/km2 | BBS | \+ |
| Sensitivity | Dependency Ratio | dependency | % | BBS | \+ |
| Sensitivity | Disabled People | disable | % | BBS | \+ |
| Sensitivity | Unemployed Population | unemployed | % | BBS | \+ |
| Sensitivity | Female to Male Ratio | fm\_ratio | Ratio | BBS | \+ |
| Sensitivity | Vulnerable Households | vulnerable\_hh | % | BBS | \+ |
| Sensitivity | Household Size | hh\_size | People/HH | BBS | \+ |
| Sensitivity | Slum / Floating Population | slum\_float | % | BBS | \+ |
| Sensitivity | Poverty Level | poverty | Class | BBS | \+ |
| Sensitivity | Crop Damage | crop\_damage | M BDT | BDRS | \+ |
| Sensitivity | Occupation Shifting | occupation | No. | BDRS | \+ |
| Sensitivity | Education Hamper | edu\_hamper | No. | BDRS | \+ |
| Sensitivity | Migration Rate | migration | No. | BDRS | \+ |
| Adaptive Cap. | Literacy Rate | literacy | % | BBS | \- |
| Adaptive Cap. | Electricity Coverage | electricity | % | BBS | \- |
| Adaptive Cap. | Solar Panel Coverage | solar | % | BBS | \- |
| Adaptive Cap. | Safe Drinking Water | drink\_water | % | BBS | \- |
| Adaptive Cap. | Sanitation Services | sanitation | % | BBS | \- |
| Adaptive Cap. | Handwashing Facilities | handwash | % | BBS | \- |
| Adaptive Cap. | Educational Institutes | edu\_institute | No./Pop | LGED/BBS | \- |

| Adaptive Cap. | Shelter Coverage | shelter\_cov | No./Pop | LGED/BBS | \- |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Adaptive Cap. | Market Coverage | market\_cov | No./Pop | LGED/BBS | \- |
| Adaptive Cap. | Mobile Financial Services | mfs | % | BBS | \- |
| Adaptive Cap. | Internet Users | internet | % | BBS | \- |
| Adaptive Cap. | Agri/Livestock/Fish Production | production | BDT | BBS | \- |
| Adaptive Cap. | Mangrove / Green Belt | mangrove | km2 | DoE | \- |
| Adaptive Cap. | CC Awareness | cc\_awareness | No. | BDRS | \- |
| Adaptive Cap. | Disaster Preparedness | disaster\_prep | No. | BDRS | \- |
| Adaptive Cap. | Social Safety Net | safety\_net | No. | BDRS | \- |
| Adaptive Cap. | Paved Road Access | pavedroad | km/km2 | RHD/LGED | \- |
| Env. Exposure | Forest Coverage | forest | % | Sentinel-2 2024 | \+ |
| Env. Exposure | Waterbody Coverage | waterbody | % | Sentinel-2 2024 | \+ |
| Env. Exposure | Agriculture Land Coverage | agri\_land | % | Sentinel-2 2024 | \+ |
| Env. Sensitivity | NDVI | ndvi | Index | Sentinel-2 | \+ |
| Env. Sensitivity | Wetland Area Loss | wetland\_loss | % | JRC-EC | \+ |
| Env. Sensitivity | Groundwater Level | groundwater | m | BWDB | \+ |

**— END OF DOCUMENT —**

*Climate Risk & Vulnerability Assessment Platform (CRVAP) | PRD v1.0 | Oxfam in Bangladesh | March 2026*