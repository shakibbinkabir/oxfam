import { useState, useEffect } from "react";
import { getIndicatorValuesByBoundary } from "../../api/indicators";
import useScores from "../../hooks/useScores";
import useMapContext from "../../contexts/MapContext";

const COMPONENT_COLORS = {
  Hazard: "bg-red-50 border-red-200 text-red-700",
  Socioeconomic: "bg-blue-50 border-blue-200 text-blue-700",
  Environmental: "bg-green-50 border-green-200 text-green-700",
  Infrastructural: "bg-orange-50 border-orange-200 text-orange-700",
};

const CRI_CATEGORY_COLORS = {
  "Very Low": { bg: "bg-green-100", text: "text-green-800", bar: "bg-green-500" },
  Low: { bg: "bg-lime-100", text: "text-lime-800", bar: "bg-lime-500" },
  Medium: { bg: "bg-yellow-100", text: "text-yellow-800", bar: "bg-yellow-500" },
  High: { bg: "bg-orange-100", text: "text-orange-800", bar: "bg-orange-500" },
  "Very High": { bg: "bg-red-100", text: "text-red-800", bar: "bg-red-600" },
};

const DIMENSION_LABELS = [
  { key: "hazard", label: "Hazard", color: "bg-red-500" },
  { key: "exposure", label: "Exposure", color: "bg-amber-500" },
  { key: "sensitivity", label: "Sensitivity", color: "bg-orange-500" },
  { key: "adaptive_capacity", label: "Adaptive Capacity", color: "bg-emerald-500" },
  { key: "vulnerability", label: "Vulnerability", color: "bg-purple-500" },
];

export default function UnionDetailPanel({ feature, onClose }) {
  const [visible, setVisible] = useState(false);
  const [indicators, setIndicators] = useState([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showRawIndicators, setShowRawIndicators] = useState(false);

  let mapCtx = null;
  try { mapCtx = useMapContext(); } catch { /* ok if not in provider */ }

  const { scores, loading: loadingScores } = useScores(feature?.pcode);

  useEffect(() => {
    if (feature) {
      requestAnimationFrame(() => setVisible(true));
      fetchIndicators(feature.pcode);
    }
  }, [feature]);

  async function fetchIndicators(pcode) {
    setLoadingIndicators(true);
    try {
      const res = await getIndicatorValuesByBoundary(pcode);
      setIndicators(res.data.data || []);
    } catch {
      setIndicators([]);
    } finally {
      setLoadingIndicators(false);
    }
  }

  function handleClose() {
    setVisible(false);
    setExpanded(false);
    setShowRawIndicators(false);
    setTimeout(onClose, 300);
  }

  function handleExportJson() {
    const exportData = {
      ...feature,
      scores,
      indicators: indicators.map((iv) => ({
        indicator_name: iv.indicator_name,
        indicator_code: iv.indicator_code,
        component: iv.component,
        subcategory: iv.subcategory,
        value: iv.value,
        source: iv.source_name,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${feature.pcode}_data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!feature) return null;

  const indicatorsWithValue = indicators.filter((iv) => iv.value != null);

  // Full-page expanded view
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[1002] bg-white overflow-y-auto">
        <div className="sticky top-0 z-10 bg-[#1B4F72] text-white shadow-md">
          <div className="px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => setExpanded(false)}
              className="px-3 py-1.5 text-sm bg-[#154360] hover:bg-[#0E2F44] rounded-md transition-colors flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
              </svg>
              Collapse
            </button>
            <h2 className="text-lg font-semibold truncate mx-4">{feature.name_en}</h2>
            <button
              onClick={handleClose}
              className="px-3 py-1.5 text-sm bg-[#154360] hover:bg-[#0E2F44] rounded-md transition-colors"
            >
              Close
            </button>
          </div>
          <Breadcrumb feature={feature} mapCtx={mapCtx} />
        </div>

        <div className="max-w-5xl mx-auto p-6">
          {/* CRI Score Card */}
          <CRIScoreCard scores={scores} loading={loadingScores} />

          {/* Dimension Bar Charts */}
          <DimensionBarCharts scores={scores} loading={loadingScores} />

          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Basic Information</h3>
              <div className="space-y-2">
                <InfoRow label="PCODE" value={feature.pcode} />
                <InfoRow label="Admin Level" value={`ADM${feature.adm_level}`} />
                {feature.area_sq_km && <InfoRow label="Area" value={`${feature.area_sq_km.toFixed(2)} km²`} />}
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Administrative Hierarchy</h3>
              <div className="space-y-2">
                {feature.division_name && <InfoRow label="Division" value={feature.division_name} />}
                {feature.district_name && <InfoRow label="District" value={feature.district_name} />}
                {feature.upazila_name && <InfoRow label="Upazila" value={feature.upazila_name} />}
              </div>
            </div>
          </div>

          {/* Normalised Indicators */}
          {scores?.normalised_values && Object.keys(scores.normalised_values).length > 0 && (
            <NormalisedIndicatorsPanel normalised={scores.normalised_values} />
          )}

          {/* Raw indicators */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Raw Indicator Values ({indicatorsWithValue.length})
            </h3>
            <button
              onClick={handleExportJson}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50"
            >
              Export as JSON
            </button>
          </div>

          {loadingIndicators ? (
            <div className="text-center py-8 text-gray-400">Loading indicators...</div>
          ) : indicatorsWithValue.length === 0 ? (
            <div className="bg-gray-50 rounded-md p-6 text-center">
              <p className="text-sm text-gray-400">No indicator values available for this area</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {indicatorsWithValue.map((iv) => (
                <IndicatorCard key={iv.id} indicator={iv} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sidebar view
  return (
    <>
      <div
        className={`fixed inset-0 z-[1000] transition-opacity duration-300 ${
          visible ? "bg-black/20" : "bg-transparent pointer-events-none"
        }`}
        onClick={handleClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-96 bg-white shadow-lg z-[1001] overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="border-b border-gray-200 bg-[#1B4F72] text-white">
          <div className="p-4 flex items-center justify-between">
            <button
              onClick={() => setExpanded(true)}
              className="p-1 hover:bg-[#154360] rounded transition-colors"
              title="Expand"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold truncate mx-2 flex-1 text-center">{feature.name_en}</h2>
            <button
              onClick={handleClose}
              className="p-1 hover:bg-[#154360] rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <Breadcrumb feature={feature} mapCtx={mapCtx} />
        </div>

        <div className="p-4 space-y-4">
          {/* CRI Score Card (compact) */}
          <CRIScoreCard scores={scores} loading={loadingScores} compact />

          {/* Dimension Bar Charts (compact) */}
          <DimensionBarCharts scores={scores} loading={loadingScores} compact />

          {/* Basic Info */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Basic Information
            </h3>
            <div className="space-y-2">
              <InfoRow label="PCODE" value={feature.pcode} />
              <InfoRow label="Admin Level" value={`ADM${feature.adm_level}`} />
              {feature.area_sq_km && (
                <InfoRow label="Area" value={`${feature.area_sq_km.toFixed(2)} km²`} />
              )}
            </div>
          </div>

          {/* Hierarchy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Administrative Hierarchy
            </h3>
            <div className="space-y-2">
              {feature.division_name && <InfoRow label="Division" value={feature.division_name} />}
              {feature.district_name && <InfoRow label="District" value={feature.district_name} />}
              {feature.upazila_name && <InfoRow label="Upazila" value={feature.upazila_name} />}
            </div>
          </div>

          {/* Normalised Values Toggle */}
          {scores?.normalised_values && Object.keys(scores.normalised_values).length > 0 && (
            <div>
              <button
                onClick={() => setShowRawIndicators(!showRawIndicators)}
                className="w-full py-2 text-sm text-[#1B4F72] font-medium hover:bg-gray-50 rounded-md border border-dashed border-gray-300 transition-colors"
              >
                {showRawIndicators ? "Hide" : "Show"} normalised indicator values ({Object.keys(scores.normalised_values).length})
              </button>
              {showRawIndicators && (
                <div className="mt-2">
                  <NormalisedIndicatorsPanel normalised={scores.normalised_values} compact />
                </div>
              )}
            </div>
          )}

          {/* Simulate Button */}
          <div className="relative group">
            <button
              disabled
              className="w-full py-2.5 text-sm font-medium rounded-md bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            >
              Simulate This Area
            </button>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              Coming in v1.4
            </div>
          </div>

          {/* Expand & Export */}
          <div className="space-y-2">
            <button
              onClick={() => setExpanded(true)}
              className="w-full py-2 text-sm text-[#1B4F72] font-medium hover:bg-gray-50 rounded-md border border-dashed border-gray-300 transition-colors"
            >
              See full details and all indicators
            </button>
            <button
              onClick={handleExportJson}
              className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Export as JSON
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


function CRIScoreCard({ scores, loading, compact = false }) {
  if (loading) {
    return (
      <div className={`${compact ? "p-3" : "p-6 mb-8"} bg-gray-50 rounded-lg text-center`}>
        <p className="text-sm text-gray-400">Computing scores...</p>
      </div>
    );
  }

  if (!scores || scores.cri == null) {
    return (
      <div className={`${compact ? "p-3" : "p-6 mb-8"} bg-gray-50 rounded-lg text-center`}>
        <p className="text-sm text-gray-400">No score data available</p>
      </div>
    );
  }

  const category = scores.cri_category || "Unknown";
  const colors = CRI_CATEGORY_COLORS[category] || CRI_CATEGORY_COLORS["Medium"];

  if (compact) {
    return (
      <div className={`rounded-lg border-2 p-3 ${colors.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase">Climate Risk Index</div>
            <div className={`text-2xl font-bold ${colors.text}`}>
              {scores.cri.toFixed(3)}
            </div>
          </div>
          <div className={`px-3 py-1 rounded-full text-sm font-semibold ${colors.bg} ${colors.text}`}>
            {category}
          </div>
        </div>
        {scores.rank && (
          <div className="mt-1 text-xs text-gray-500">
            Ranked {scores.rank} of {scores.rank_total}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 p-6 mb-8 ${colors.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Climate Risk Index (CRI)</h3>
          <div className={`text-5xl font-bold mt-2 ${colors.text}`}>
            {scores.cri.toFixed(3)}
          </div>
          <div className="text-sm text-gray-500 mt-1">Score range: 0.000 (lowest) to 1.000 (highest risk)</div>
          {scores.rank && (
            <div className="text-sm text-gray-600 mt-1 font-medium">
              Ranked {scores.rank} of {scores.rank_total}
            </div>
          )}
        </div>
        <div className={`px-4 py-2 rounded-full text-lg font-bold ${colors.bg} ${colors.text} border ${colors.text.replace("text", "border")}`}>
          {category}
        </div>
      </div>
    </div>
  );
}


function DimensionBarCharts({ scores, loading, compact = false }) {
  if (loading || !scores) return null;

  return (
    <div className={compact ? "space-y-2" : "mb-8 space-y-3"}>
      <h3 className={`${compact ? "text-xs" : "text-sm"} font-semibold text-gray-500 uppercase tracking-wider`}>
        Dimension Scores
      </h3>
      {DIMENSION_LABELS.map(({ key, label, color }) => {
        const value = scores[key];
        if (value == null) return null;
        const pct = Math.max(0, Math.min(100, value * 100));
        return (
          <div key={key}>
            <div className="flex justify-between items-center mb-1">
              <span className={`${compact ? "text-xs" : "text-sm"} font-medium text-gray-700`}>{label}</span>
              <span className={`${compact ? "text-xs" : "text-sm"} font-bold text-gray-800`}>{value.toFixed(3)}</span>
            </div>
            <div className={`w-full ${compact ? "h-2" : "h-3"} bg-gray-200 rounded-full overflow-hidden`}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}


function NormalisedIndicatorsPanel({ normalised, compact = false }) {
  // Group by dimension
  const grouped = {};
  for (const [gisId, info] of Object.entries(normalised)) {
    const dimension = getDimensionForCode(gisId);
    if (!grouped[dimension]) grouped[dimension] = [];
    grouped[dimension].push({ gisId, ...info });
  }

  const dimensionOrder = [
    "Hazard", "Soc. Exposure", "Sensitivity",
    "Adaptive Capacity", "Env. Exposure", "Env. Sensitivity",
  ];

  return (
    <div className={compact ? "" : "mb-8"}>
      {!compact && (
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Normalised Indicator Values</h3>
      )}
      <div className="space-y-3">
        {dimensionOrder.map((dim) => {
          const items = grouped[dim];
          if (!items || items.length === 0) return null;
          return (
            <NormalisedDimensionGroup
              key={dim}
              dimension={dim}
              items={items}
              compact={compact}
            />
          );
        })}
      </div>
    </div>
  );
}


function NormalisedDimensionGroup({ dimension, items, compact }) {
  const [open, setOpen] = useState(!compact);

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-xs font-semibold text-gray-600 uppercase">{dimension} ({items.length})</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="divide-y">
          {items.map((item) => (
            <div key={item.gisId} className="px-3 py-2 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-700 truncate">{item.name}</div>
                <div className="text-xs text-gray-400">
                  Raw: {item.raw_value} | Dir: {item.direction === "-" ? "Inverted" : "Positive"}
                </div>
              </div>
              <div className="ml-3 flex items-center gap-2">
                <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.max(0, Math.min(100, item.normalised_value * 100))}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-700 w-10 text-right">
                  {item.normalised_value.toFixed(3)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function getDimensionForCode(gisId) {
  const HAZARD = ["rainfall", "heat", "colddays", "drought", "water", "erosion", "surge", "salinity", "lightning"];
  const SOC_EXP = ["population", "household", "female", "child_old"];
  const SENS = ["pop_density", "dependency", "disable", "unemployed", "fm_ratio", "vulnerable_hh", "hh_size", "slum_float", "poverty", "crop_damage", "occupation", "edu_hamper", "migration"];
  const AC = ["literacy", "electricity", "solar", "drink_water", "sanitation", "handwash", "edu_institute", "shelter_cov", "market_cov", "mfs", "internet", "production", "mangrove", "cc_awareness", "disaster_prep", "safety_net", "pavedroad"];
  const ENV_EXP = ["forest", "waterbody", "agri_land"];
  const ENV_SENS = ["ndvi", "wetland_loss", "groundwater"];

  if (HAZARD.includes(gisId)) return "Hazard";
  if (SOC_EXP.includes(gisId)) return "Soc. Exposure";
  if (SENS.includes(gisId)) return "Sensitivity";
  if (AC.includes(gisId)) return "Adaptive Capacity";
  if (ENV_EXP.includes(gisId)) return "Env. Exposure";
  if (ENV_SENS.includes(gisId)) return "Env. Sensitivity";
  return "Other";
}


function Breadcrumb({ feature, mapCtx }) {
  const crumbs = [];
  if (feature.division_name) crumbs.push({ label: feature.division_name, level: 1 });
  if (feature.district_name) crumbs.push({ label: feature.district_name, level: 2 });
  if (feature.upazila_name) crumbs.push({ label: feature.upazila_name, level: 3 });
  crumbs.push({ label: feature.name_en, level: feature.adm_level, current: true });

  // Deduplicate (if name_en equals last hierarchy name)
  const unique = [];
  const seen = new Set();
  for (const c of crumbs) {
    const key = `${c.label}-${c.level}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }

  return (
    <div className="px-4 pb-2 flex items-center gap-1 text-xs text-white/60 overflow-x-auto">
      {unique.map((c, i) => (
        <span key={i} className="flex items-center gap-1 shrink-0">
          {i > 0 && <span className="text-white/30">&rsaquo;</span>}
          {c.current ? (
            <span className="text-white/90 font-medium">{c.label}</span>
          ) : (
            <button
              onClick={() => mapCtx?.resetView()}
              className="hover:text-white/80 transition-colors"
            >
              {c.label}
            </button>
          )}
        </span>
      ))}
      {feature.area_sq_km && (
        <span className="ml-auto text-white/40 shrink-0">{feature.area_sq_km.toFixed(1)} km²</span>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value}</span>
    </div>
  );
}


function IndicatorCard({ indicator }) {
  const colorClass = COMPONENT_COLORS[indicator.component] || "bg-gray-50 border-gray-200 text-gray-700";
  return (
    <div className={`rounded-lg border p-4 ${colorClass}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium opacity-70">{indicator.component} · {indicator.subcategory || "\u2014"}</div>
          <div className="text-sm font-medium mt-1 truncate">{indicator.indicator_name}</div>
        </div>
        <div className="text-lg font-bold ml-3 shrink-0">{indicator.value}</div>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs opacity-60">
        <span>{indicator.indicator_code}</span>
        {indicator.source_name && <span>{indicator.source_name}</span>}
      </div>
    </div>
  );
}
