import { useTranslation } from "react-i18next";
import { MapProvider } from "../../contexts/MapContext";
import useMapContext from "../../contexts/MapContext";
import LeafletMap from "./LeafletMap";
import UnionDetailPanel from "./UnionDetailPanel";
import KPISummaryBar from "./KPISummaryBar";
import SimulationModal from "./SimulationModal";

const INDICATOR_OPTIONS = [
  { value: "cri", label: "CRI" },
  { value: "hazard", label: "Hazard" },
  { value: "exposure", label: "Exposure" },
  { value: "sensitivity", label: "Sensitivity" },
  { value: "adaptive_capacity", label: "Adaptive Capacity" },
  { value: "vulnerability", label: "Vulnerability" },
];

function IndicatorSelector() {
  const { t } = useTranslation();
  const { indicator, setIndicator } = useMapContext();

  return (
    <div className="flex gap-1 bg-white px-3 py-1.5" role="toolbar" aria-label="Map indicator selector">
      {INDICATOR_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setIndicator(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            indicator === opt.value
              ? "bg-[#1B4F72] text-white"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {t('indicator_selector.' + opt.value)}
        </button>
      ))}
    </div>
  );
}

function MapContent() {
  const { selectedFeature, clearSelection } = useMapContext();

  return (
    <div className="flex flex-col w-full h-full">
      <KPISummaryBar />
      <IndicatorSelector />
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="map-status">
        {selectedFeature ? `Selected: ${selectedFeature.name_en}` : ""}
      </div>
      <div className="relative flex-1 min-h-0">
        {/* On mobile, hide map when detail panel is open */}
        <div className={selectedFeature ? "hidden lg:block w-full h-full" : "w-full h-full"}>
          <LeafletMap />
        </div>
        {selectedFeature && (
          <UnionDetailPanel
            feature={selectedFeature}
            onClose={clearSelection}
          />
        )}
      </div>
      <SimulationModal />
    </div>
  );
}

export default function MapPage() {
  return (
    <MapProvider>
      <MapContent />
    </MapProvider>
  );
}
