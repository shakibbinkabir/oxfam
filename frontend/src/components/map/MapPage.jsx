import { useState } from "react";
import LeafletMap from "./LeafletMap";
import UnionDetailPanel from "./UnionDetailPanel";

export default function MapPage() {
  const [selectedFeature, setSelectedFeature] = useState(null);

  return (
    <div className="relative w-full h-full">
      <LeafletMap
        onFeatureClick={setSelectedFeature}
        selectedPcode={selectedFeature?.pcode || null}
      />
      {selectedFeature && (
        <UnionDetailPanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
        />
      )}
    </div>
  );
}
