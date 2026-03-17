import { useState, useEffect } from "react";
import { getIndicatorValuesByBoundary } from "../../api/indicators";

const COMPONENT_COLORS = {
  Hazard: "bg-red-50 border-red-200 text-red-700",
  Socioeconomic: "bg-blue-50 border-blue-200 text-blue-700",
  Environmental: "bg-green-50 border-green-200 text-green-700",
  Infrastructural: "bg-orange-50 border-orange-200 text-orange-700",
};

export default function UnionDetailPanel({ feature, onClose }) {
  const [visible, setVisible] = useState(false);
  const [indicators, setIndicators] = useState([]);
  const [loadingIndicators, setLoadingIndicators] = useState(false);
  const [expanded, setExpanded] = useState(false);

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
    setTimeout(onClose, 300);
  }

  function handleExportJson() {
    const exportData = {
      ...feature,
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
  const previewIndicators = indicatorsWithValue.slice(0, 5);
  const hasMore = indicatorsWithValue.length > 5;

  // Full-page expanded view
  if (expanded) {
    return (
      <div className="fixed inset-0 z-[1002] bg-white overflow-y-auto">
        {/* Title bar */}
        <div className="sticky top-0 z-10 bg-[#1B4F72] text-white px-6 py-4 flex items-center justify-between shadow-md">
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

        <div className="max-w-5xl mx-auto p-6">
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

          {/* All indicators */}
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">
              Climate Indicators ({indicatorsWithValue.length})
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
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[1000] transition-opacity duration-300 ${
          visible ? "bg-black/20" : "bg-transparent pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white shadow-lg z-[1001] overflow-y-auto transform transition-transform duration-300 ease-in-out ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#1B4F72] text-white">
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

        <div className="p-4 space-y-4">
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

          {/* Climate Indicators */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Climate Indicators
            </h3>
            {loadingIndicators ? (
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <p className="text-sm text-gray-400">Loading...</p>
              </div>
            ) : indicatorsWithValue.length === 0 ? (
              <div className="bg-gray-50 rounded-md p-3 text-center">
                <p className="text-sm text-gray-400">No indicator values available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {previewIndicators.map((iv) => (
                  <div key={iv.id} className={`rounded-md border p-2 ${COMPONENT_COLORS[iv.component] || "bg-gray-50 border-gray-200"}`}>
                    <div className="text-xs font-medium truncate">{iv.indicator_name}</div>
                    <div className="text-sm font-bold mt-0.5">{iv.value}</div>
                    {iv.source_name && <div className="text-xs opacity-60 mt-0.5">{iv.source_name}</div>}
                  </div>
                ))}
                {hasMore && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="w-full py-2 text-sm text-[#1B4F72] font-medium hover:bg-gray-50 rounded-md border border-dashed border-gray-300 transition-colors"
                  >
                    See all {indicatorsWithValue.length} indicators →
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Export */}
          <button
            onClick={handleExportJson}
            className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Export as JSON
          </button>
        </div>
      </div>
    </>
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
          <div className="text-xs font-medium opacity-70">{indicator.component} · {indicator.subcategory || "—"}</div>
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
