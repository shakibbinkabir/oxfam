export default function UnionDetailPanel({ feature, onClose }) {
  if (!feature) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-lg z-[1001] transform transition-transform duration-300 ease-in-out overflow-y-auto">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-[#1B4F72] text-white">
        <h2 className="text-lg font-semibold truncate">{feature.name_en}</h2>
        <button
          onClick={onClose}
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
            {feature.division_name && (
              <InfoRow label="Division" value={feature.division_name} />
            )}
            {feature.district_name && (
              <InfoRow label="District" value={feature.district_name} />
            )}
            {feature.upazila_name && (
              <InfoRow label="Upazila" value={feature.upazila_name} />
            )}
          </div>
        </div>

        {/* Climate Indicators Placeholder */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Climate Indicators
          </h3>
          <div className="bg-gray-50 rounded-md p-3 text-center">
            <p className="text-sm text-gray-400">No data yet</p>
            <p className="text-xs text-gray-300 mt-1">
              Indicator values will be available in Phase 2
            </p>
          </div>
        </div>

        {/* Export */}
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(feature, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${feature.pcode}_metadata.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="w-full py-2 px-4 border border-gray-300 rounded-md text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Export as JSON
        </button>
      </div>
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
