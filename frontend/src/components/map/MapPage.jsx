import { MapProvider } from "../../contexts/MapContext";
import useMapContext from "../../contexts/MapContext";
import LeafletMap from "./LeafletMap";
import UnionDetailPanel from "./UnionDetailPanel";
import KPISummaryBar from "./KPISummaryBar";
import SimulationModal from "./SimulationModal";

function MapContent() {
  const { selectedFeature, clearSelection } = useMapContext();

  return (
    <div className="flex flex-col w-full h-full">
      <KPISummaryBar />
      <div className="relative flex-1 min-h-0">
        <LeafletMap />
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
