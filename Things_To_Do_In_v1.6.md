# Things To Do In v1.6 — Bilingual Support (English / Bangla)

**Theme:** *The Voice — Make the platform accessible to all Bangladeshi stakeholders in their own language*
**Priority:** P2 — Medium
**Depends on:** v1.5 (all functional features complete)
**Unlocks:** Local government adoption, community engagement, PRD bilingual parity requirement

---

## Why This Version Matters

The PRD mandates English and Bangla as **equal first-class citizens**. Local Government Officers (Union Parishad Chairmen, UNOs) — a primary user persona — may use **only Bangla**. Without bilingual support, an entire stakeholder segment is excluded. This version is a **standalone deliverable** with no feature dependencies — it wraps existing functionality in i18n.

---

## i18n Infrastructure

### 1. Frontend i18n Framework Setup

- [ ] Install `react-i18next` and `i18next`:
  ```bash
  npm install react-i18next i18next i18next-browser-languagedetector
  ```
- [ ] Create i18n configuration in `src/i18n/index.js`:
  - Default language: `en`
  - Fallback language: `en`
  - Supported languages: `['en', 'bn']`
  - Namespace: `translation` (single namespace for simplicity)
- [ ] Initialize i18n in `main.jsx` before React renders
- [ ] Create translation files:
  - `src/i18n/locales/en.json` — English translations
  - `src/i18n/locales/bn.json` — Bangla translations

### 2. Language Switcher

- [ ] Add language toggle button in the **top navigation bar** (header):
  - Shows current language: "EN" / "বাংলা"
  - Click toggles between English and Bangla
  - Or: dropdown with both options
- [ ] **Persist language preference:**
  - Store in `localStorage` key: `preferred_language`
  - On app load: check localStorage, apply saved preference
  - Optionally: save to user profile on backend (future enhancement)
- [ ] Switcher visible on all pages including login/register

### 3. Noto Sans Bengali Font

- [ ] Add Google Font: `Noto Sans Bengali` for Bangla text rendering
- [ ] Load via `@import` in `index.css` or `<link>` in `index.html`:
  ```css
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap');
  ```
- [ ] Apply font-family conditionally when language is `bn`:
  ```css
  [lang="bn"] { font-family: 'Noto Sans Bengali', sans-serif; }
  ```
- [ ] Set `<html lang="...">` attribute dynamically based on selected language

---

## Translation — UI Labels

### 4. Navigation & Layout

- [ ] Sidebar menu items:
  - Dashboard / ড্যাশবোর্ড
  - Indicators / সূচক
  - Submit Value / মান জমা দিন
  - List of Values / মানের তালিকা
  - Value Uploader / মান আপলোডার
  - Units / একক
  - Sources / উৎস
  - Users / ব্যবহারকারী
  - Audit Log / নিরীক্ষা লগ
  - Scenarios / দৃশ্যপট
- [ ] Header: "Climate Risk Bangladesh Assessment" / "জলবায়ু ঝুঁকি বাংলাদেশ মূল্যায়ন"
- [ ] Logout / লগ আউট
- [ ] User role labels: Superadmin / সুপার অ্যাডমিন, Admin / অ্যাডমিন, User / ব্যবহারকারী

### 5. Authentication Pages

- [ ] Login page: Email, Password, "Sign In", "Don't have an account?", etc.
- [ ] Register page: Full Name, Email, Password, "Create Account", etc.
- [ ] Error messages: "Invalid credentials" / "অবৈধ শংসাপত্র", etc.
- [ ] Validation messages: "Password must be at least 8 characters" / "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে"

### 6. Map & Dashboard

- [ ] KPI bar labels: "Highest Risk Area" / "সর্বোচ্চ ঝুঁকিপূর্ণ এলাকা", "Average CRI" / "গড় CRI", etc.
- [ ] Indicator selector labels: CRI, Hazard/বিপদ, Exposure/এক্সপোজার, Sensitivity/সংবেদনশীলতা, Adaptive Capacity/অভিযোজন সক্ষমতা
- [ ] Legend title and category labels:
  - Very Low / অতি নিম্ন
  - Low / নিম্ন
  - Medium / মাঝারি
  - High / উচ্চ
  - Very High / অতি উচ্চ
- [ ] Tooltip: "Rank X of Y" / "র‌্যাঙ্ক X / Y এর মধ্যে"

### 7. Detail Side Panel

- [ ] Section headers: "Climate Indicators" / "জলবায়ু সূচক", "Basic Info" / "প্রাথমিক তথ্য"
- [ ] Score card labels: "Climate Risk Index" / "জলবায়ু ঝুঁকি সূচক"
- [ ] Dimension names in bar charts
- [ ] "Simulate This Area" / "এই এলাকা সিমুলেট করুন"
- [ ] "Download PDF" / "PDF ডাউনলোড", "Export CSV" / "CSV রপ্তানি"

### 8. Forms & Modals

- [ ] All form labels, placeholders, and button text
- [ ] Wizard step labels: "Step 1 of 5" / "ধাপ ১ / ৫"
- [ ] Confirmation modals: "Are you sure?" / "আপনি কি নিশ্চিত?"
- [ ] Success/error toast messages
- [ ] Simulation modal labels and result descriptions

### 9. Table Components

- [ ] Column headers in all TanStack tables
- [ ] Pagination: "Showing X to Y of Z" / "Z এর মধ্যে X থেকে Y দেখানো হচ্ছে"
- [ ] Filter labels and search placeholders
- [ ] Action button labels: Edit/সম্পাদনা, Delete/মুছুন, Restore/পুনরুদ্ধার

---

## Bilingual Geographic Data

### 10. Bangla Admin Boundary Names

- [ ] Add `name_bn` column to `admin_boundaries` table via migration (varchar, nullable)
- [ ] Populate `name_bn` from official BBS data:
  - If BBS shapefile has `ADM_BN` attribute, use it
  - Otherwise: use a translation lookup table or crowdsourced data
  - Fallback: set `name_bn = name_en` for boundaries without Bangla names
- [ ] Update GeoJSON API response to include both `name_en` and `name_bn`
- [ ] Update geo list endpoints (divisions, districts, upazilas, unions) to return `name_bn`

### 11. Bilingual Map Display

- [ ] Map hover tooltip: show `name_bn` when language is Bangla, `name_en` when English
- [ ] Detail Side Panel header: show name in current language
- [ ] Location breadcrumbs: use current language names
- [ ] KPI bar "Highest Risk Area": show name in current language

### 12. Bilingual Indicator Names

- [ ] Add `indicator_name_bn` column to `climate_indicators` table via migration (varchar, nullable)
- [ ] Populate Bangla indicator names:
  - Source: Oxfam team or translation service
  - Store as data, not i18n keys (these are domain-specific terms)
- [ ] API responses include both `indicator_name` and `indicator_name_bn`
- [ ] Frontend: display based on current language preference
- [ ] Detail panel, wizard form, tables: all show bilingual indicator names

---

## PDF Export — Bilingual

### 13. Bilingual PDF Reports

- [ ] PDF report respects current language preference:
  - Headers, labels, category names in selected language
  - Area name in selected language
  - Indicator names in selected language
- [ ] Ensure Noto Sans Bengali font is embedded in PDF (ReportLab font registration)
- [ ] Add language parameter to PDF export endpoint: `GET /api/v1/export/pdf?pcode=...&lang=bn`

---

## Testing

- [ ] Test: All UI text renders correctly in Bangla without overflow/clipping
- [ ] Test: Language switcher persists preference across page reloads
- [ ] Test: Map tooltips show Bangla names when language is `bn`
- [ ] Test: PDF export in Bangla renders Noto Sans Bengali correctly
- [ ] Test: All forms, modals, and tables display Bangla labels
- [ ] Test: Fallback to English when Bangla translation is missing
- [ ] Test: Login/register flow works fully in Bangla

---

## Acceptance Criteria

1. Language toggle in the header switches all UI text between English and Bangla instantly (no page reload).
2. Noto Sans Bengali font renders Bangla text clearly at all sizes.
3. Map tooltips, legend, KPI bar, and detail panel show text in the selected language.
4. Admin boundary names display in Bangla when language is set to `bn`.
5. Indicator names appear in Bangla in forms, tables, and side panel.
6. PDF reports can be generated in Bangla with proper font rendering.
7. Language preference persists across sessions via localStorage.
8. A Local Government Officer can navigate the entire platform, view their area's CRI score, and understand the breakdown — entirely in Bangla.

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| i18n infrastructure | 3 items | Medium |
| UI translation (EN/BN) | 6 items | Medium (volume) |
| Bilingual data (boundaries, indicators) | 3 items | Medium |
| PDF bilingual | 1 item | Low-Medium |
| Testing | 7 tests | Medium |
| **Total** | **20 items** | **Medium** |

**Note:** The bulk of this work is translation volume, not technical complexity. Consider engaging an Oxfam Bangladesh team member for translation review.

**After v1.6:** The platform is accessible to all four PRD user personas, including Local Government Officers who require Bangla UI. Bilingual parity is achieved.
