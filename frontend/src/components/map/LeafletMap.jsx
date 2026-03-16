import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from "react-leaflet";
import useGeoData from "../../hooks/useGeoData";

const DIVISION_COLORS = {
  Barishal: "#E74C3C",
  Chattogram: "#3498DB",
  Dhaka: "#2ECC71",
  Khulna: "#F39C12",
  Mymensingh: "#9B59B6",
  Rajshahi: "#1ABC9C",
  Rangpur: "#E67E22",
  Sylhet: "#34495E",
};

function getFeatureStyle(feature) {
  const level = feature.properties.adm_level;
  const division = feature.properties.division_name || feature.properties.name_en;
  const baseColor = DIVISION_COLORS[division] || "#95A5A6";

  switch (level) {
    case 1:
      return {
        fillColor: baseColor,
        weight: 2,
        opacity: 1,
        color: "#fff",
        fillOpacity: 0.6,
      };
    case 2:
      return {
        fillColor: baseColor,
        weight: 1.5,
        opacity: 0.8,
        color: "#fff",
        fillOpacity: 0.45,
      };
    case 3:
      return {
        fillColor: baseColor,
        weight: 1,
        opacity: 0.7,
        color: "#fff",
        fillOpacity: 0.35,
      };
    case 4:
      return {
        fillColor: "#E8E8E8",
        weight: 0.5,
        opacity: 0.6,
        color: "#999",
        fillOpacity: 0.3,
      };
    default:
      return {
        fillColor: "#ccc",
        weight: 1,
        opacity: 0.5,
        color: "#999",
        fillOpacity: 0.3,
      };
  }
}

function buildTooltip(props) {
  const parts = [props.name_en];
  if (props.upazila_name) parts.push(`Upazila: ${props.upazila_name}`);
  if (props.district_name) parts.push(`District: ${props.district_name}`);
  if (props.division_name) parts.push(`Division: ${props.division_name}`);
  return parts.join("<br/>");
}

function MapEventHandler({ onViewChange }) {
  useMapEvents({
    zoomend: (e) => {
      const map = e.target;
      onViewChange(map.getZoom(), map.getBounds());
    },
    moveend: (e) => {
      const map = e.target;
      onViewChange(map.getZoom(), map.getBounds());
    },
  });
  return null;
}

export default function LeafletMap({ onFeatureClick }) {
  const [zoom, setZoom] = useState(7);
  const [bounds, setBounds] = useState(null);
  const { geoData, loading } = useGeoData(zoom, bounds);
  const geoJsonRef = useRef(null);
  const [geoKey, setGeoKey] = useState(0);

  const handleViewChange = useCallback((newZoom, newBounds) => {
    setZoom(newZoom);
    setBounds(newBounds);
  }, []);

  useEffect(() => {
    if (geoData) {
      setGeoKey((prev) => prev + 1);
    }
  }, [geoData]);

  const onEachFeature = useCallback(
    (feature, layer) => {
      layer.bindTooltip(buildTooltip(feature.properties), {
        sticky: true,
        className: "geo-tooltip",
      });

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          l.setStyle({ fillOpacity: 0.8, weight: 3 });
          l.bringToFront();
        },
        mouseout: (e) => {
          const l = e.target;
          l.setStyle(getFeatureStyle(feature));
        },
        click: () => {
          if (onFeatureClick) onFeatureClick(feature.properties);
        },
      });
    },
    [onFeatureClick]
  );

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-md shadow-md text-sm text-gray-600">
          Loading boundaries...
        </div>
      )}
      <MapContainer
        center={[23.685, 90.3563]}
        zoom={7}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEventHandler onViewChange={handleViewChange} />
        {geoData && geoData.features && geoData.features.length > 0 && (
          <GeoJSON
            key={geoKey}
            ref={geoJsonRef}
            data={geoData}
            style={getFeatureStyle}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-md shadow-md p-3">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Divisions</h4>
        <div className="space-y-1">
          {Object.entries(DIVISION_COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-gray-700">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
