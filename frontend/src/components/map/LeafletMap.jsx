import { useEffect, useState, useCallback, useRef } from "react";
import { MapContainer, TileLayer, GeoJSON, useMapEvents } from "react-leaflet";
import L from "leaflet";
import useGeoData from "../../hooks/useGeoData";

const DIVISION_COLORS = {
  Barishal: "#E74C3C",
  Barisal: "#E74C3C",
  Chattogram: "#3498DB",
  Chittagong: "#3498DB",
  Dhaka: "#2ECC71",
  Khulna: "#F39C12",
  Mymensingh: "#9B59B6",
  Rajshahi: "#1ABC9C",
  Rangpur: "#E67E22",
  Sylhet: "#34495E",
};

const LEVEL_RADIUS = { 1: 28, 2: 18, 3: 12, 4: 10 };

function getDivisionColor(props) {
  const division = props.division_name || props.name_en;
  return DIVISION_COLORS[division] || "#95A5A6";
}

function getFeatureStyle(feature) {
  const level = feature.properties.adm_level;
  const baseColor = getDivisionColor(feature.properties);

  switch (level) {
    case 1:
      return { fillColor: baseColor, weight: 2, opacity: 1, color: "#fff", fillOpacity: 0.6 };
    case 2:
      return { fillColor: baseColor, weight: 1.5, opacity: 0.8, color: "#fff", fillOpacity: 0.5 };
    case 3:
      return { fillColor: baseColor, weight: 1, opacity: 0.7, color: "#fff", fillOpacity: 0.45 };
    case 4:
      return { fillColor: baseColor, weight: 1, opacity: 0.7, color: "#fff", fillOpacity: 0.5 };
    default:
      return { fillColor: "#ccc", weight: 1, opacity: 0.5, color: "#999", fillOpacity: 0.3 };
  }
}

function getSelectedStyle(feature) {
  const baseColor = getDivisionColor(feature.properties);
  return {
    fillColor: baseColor,
    weight: 4,
    opacity: 1,
    color: "#FFD700",
    fillOpacity: 0.7,
    dashArray: "",
  };
}

function buildTooltipHtml(props) {
  const parts = [`<b>${props.name_en}</b>`];
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

export default function LeafletMap({ onFeatureClick, selectedPcode }) {
  const [zoom, setZoom] = useState(7);
  const [bounds, setBounds] = useState(null);
  const { geoData, loading } = useGeoData(zoom, bounds);
  const [geoKey, setGeoKey] = useState(0);
  const selectedLayerRef = useRef(null);

  const handleViewChange = useCallback((newZoom, newBounds) => {
    setZoom(newZoom);
    setBounds(newBounds);
  }, []);

  useEffect(() => {
    if (geoData) setGeoKey((prev) => prev + 1);
  }, [geoData]);

  // Clear highlight when panel closes
  useEffect(() => {
    if (!selectedPcode && selectedLayerRef.current) {
      const layer = selectedLayerRef.current.layer;
      const feature = selectedLayerRef.current.feature;
      if (feature.geometry.type === "Point") {
        layer.setStyle({
          fillOpacity: 0.85,
          weight: 2,
          radius: LEVEL_RADIUS[feature.properties.adm_level] || 10,
          color: "#fff",
        });
      } else {
        layer.setStyle(getFeatureStyle(feature));
      }
      selectedLayerRef.current = null;
    }
  }, [selectedPcode]);

  // Point fallback for features without polygon geometry
  const pointToLayer = useCallback((feature, latlng) => {
    const level = feature.properties.adm_level;
    const color = getDivisionColor(feature.properties);
    const radius = LEVEL_RADIUS[level] || 10;
    return L.circleMarker(latlng, {
      radius,
      fillColor: color,
      color: "#fff",
      weight: 2,
      fillOpacity: 0.85,
    });
  }, []);

  const onEachFeature = useCallback(
    (feature, layer) => {
      layer.bindTooltip(buildTooltipHtml(feature.properties), {
        sticky: true,
        direction: "top",
        offset: [0, -8],
      });

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          // Don't override selected style
          if (selectedLayerRef.current?.layer === l) return;
          if (feature.geometry.type === "Point") {
            l.setStyle({
              fillOpacity: 1,
              weight: 3,
              radius: (LEVEL_RADIUS[feature.properties.adm_level] || 10) + 4,
            });
          } else {
            l.setStyle({ fillOpacity: 0.8, weight: 3, color: "#FFD700" });
          }
          l.bringToFront();
        },
        mouseout: (e) => {
          const l = e.target;
          // Don't reset selected style
          if (selectedLayerRef.current?.layer === l) return;
          if (feature.geometry.type === "Point") {
            l.setStyle({
              fillOpacity: 0.85,
              weight: 2,
              color: "#fff",
              radius: LEVEL_RADIUS[feature.properties.adm_level] || 10,
            });
          } else {
            l.setStyle(getFeatureStyle(feature));
          }
        },
        click: () => {
          // Reset previous selection
          if (selectedLayerRef.current) {
            const prev = selectedLayerRef.current;
            if (prev.feature.geometry.type === "Point") {
              prev.layer.setStyle({
                fillOpacity: 0.85,
                weight: 2,
                color: "#fff",
                radius: LEVEL_RADIUS[prev.feature.properties.adm_level] || 10,
              });
            } else {
              prev.layer.setStyle(getFeatureStyle(prev.feature));
            }
          }

          // Highlight clicked feature
          if (feature.geometry.type === "Point") {
            layer.setStyle({
              fillOpacity: 1,
              weight: 4,
              color: "#FFD700",
              radius: (LEVEL_RADIUS[feature.properties.adm_level] || 10) + 4,
            });
          } else {
            layer.setStyle(getSelectedStyle(feature));
          }
          layer.bringToFront();
          selectedLayerRef.current = { layer, feature };

          if (onFeatureClick) onFeatureClick(feature.properties);
        },
      });
    },
    [onFeatureClick]
  );

  const hasFeatures = geoData?.features?.length > 0;

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

        {hasFeatures && (
          <GeoJSON
            key={geoKey}
            data={geoData}
            style={getFeatureStyle}
            pointToLayer={pointToLayer}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-md shadow-md p-3">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">Divisions</h4>
        <div className="space-y-1">
          {[
            ["Barishal", "#E74C3C"],
            ["Chattogram", "#3498DB"],
            ["Dhaka", "#2ECC71"],
            ["Khulna", "#F39C12"],
            ["Mymensingh", "#9B59B6"],
            ["Rajshahi", "#1ABC9C"],
            ["Rangpur", "#E67E22"],
            ["Sylhet", "#34495E"],
          ].map(([name, color]) => (
            <div key={name} className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full inline-block"
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
