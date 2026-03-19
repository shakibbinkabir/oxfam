import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import useMapScores from "../../hooks/useMapScores";
import useMapContext from "../../contexts/MapContext";

const SCORE_COLORS = [
  { min: 0.0, max: 0.2, color: "#2ECC71", label: "Very Low" },
  { min: 0.2, max: 0.4, color: "#F1C40F", label: "Low" },
  { min: 0.4, max: 0.6, color: "#E67E22", label: "Medium" },
  { min: 0.6, max: 0.8, color: "#E74C3C", label: "High" },
  { min: 0.8, max: 1.0, color: "#8B0000", label: "Very High" },
];

const NO_DATA_COLOR = "#A6ACAF";

const INDICATOR_OPTIONS = [
  { value: "cri", label: "CRI" },
  { value: "hazard", label: "Hazard" },
  { value: "exposure", label: "Exposure" },
  { value: "sensitivity", label: "Sensitivity" },
  { value: "adaptive_capacity", label: "Adaptive Capacity" },
  { value: "vulnerability", label: "Vulnerability" },
];

const TILE_LAYERS = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", name: "Street", attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' },
  light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", name: "Light", attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", name: "Dark", attribution: '&copy; <a href="https://carto.com/">CARTO</a>' },
};

const LEVEL_RADIUS = { 1: 28, 2: 18, 3: 12, 4: 10 };

function getScoreColor(score) {
  if (score == null) return NO_DATA_COLOR;
  for (const band of SCORE_COLORS) {
    if (score < band.max || (score === 1.0 && band.max === 1.0)) return band.color;
  }
  return SCORE_COLORS[SCORE_COLORS.length - 1].color;
}

function getCategory(score) {
  if (score == null) return "No Data";
  for (const band of SCORE_COLORS) {
    if (score < band.max || (score === 1.0 && band.max === 1.0)) return band.label;
  }
  return "Very High";
}

function getFeatureStyle(feature) {
  const score = feature.properties.score;
  const fillColor = getScoreColor(score);
  const level = feature.properties.adm_level;
  const weight = level === 1 ? 2 : level === 2 ? 1.5 : 1;
  return {
    fillColor,
    weight,
    opacity: 1,
    color: "#fff",
    fillOpacity: score != null ? 0.7 : 0.5,
    dashArray: score == null ? "4 4" : "",
  };
}

function buildTooltipHtml(props, indicator, rank, total) {
  const score = props.score;
  const category = getCategory(score);
  const indicatorLabel = INDICATOR_OPTIONS.find((o) => o.value === indicator)?.label || "CRI";
  const parts = [`<div style="font-size:13px;line-height:1.5">`];
  parts.push(`<b>${props.name_en}</b>`);
  if (score != null) {
    parts.push(`<br/>${indicatorLabel}: <b>${score.toFixed(3)}</b> <span style="opacity:0.7">(${category})</span>`);
    if (rank && total) parts.push(`<br/>Rank: <b>${rank}</b> of ${total}`);
  } else {
    parts.push(`<br/><span style="opacity:0.6">No data available</span>`);
  }
  parts.push("</div>");
  return parts.join("");
}

function MapEventHandler({ onViewChange }) {
  useMapEvents({
    zoomend: (e) => onViewChange(e.target.getZoom(), e.target.getBounds()),
    moveend: (e) => onViewChange(e.target.getZoom(), e.target.getBounds()),
  });
  return null;
}

function FitBoundsOnData({ geoData }) {
  const map = useMap();
  const prevDataRef = useRef(null);

  useEffect(() => {
    if (!geoData?.features?.length) return;
    const key = geoData.features.map((f) => f.properties.pcode).sort().join(",");
    if (key === prevDataRef.current) return;
    prevDataRef.current = key;

    try {
      const layer = L.geoJSON(geoData);
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    } catch {
      // ignore invalid geojson
    }
  }, [geoData, map]);

  return null;
}

export default function LeafletMap() {
  const {
    level, indicator, selectedPcode, parentPcode,
    canDrillDown, canDrillUp,
    setIndicator, selectFeature, clearSelection, drillDown, drillUp, resetView,
  } = useMapContext();

  const [bounds, setBounds] = useState(null);
  const [tileLayer, setTileLayer] = useState("osm");
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const selectedLayerRef = useRef(null);
  const geoJsonRef = useRef(null);

  const { geoData, loading } = useMapScores(level, indicator, null, parentPcode);

  const [geoKey, setGeoKey] = useState(0);
  useEffect(() => {
    if (geoData) setGeoKey((prev) => prev + 1);
  }, [geoData]);

  // Compute ranks
  const rankMap = useMemo(() => {
    if (!geoData?.features) return {};
    const scored = geoData.features
      .filter((f) => f.properties.score != null)
      .sort((a, b) => b.properties.score - a.properties.score);
    const ranks = {};
    scored.forEach((f, i) => {
      ranks[f.properties.pcode] = { rank: i + 1, total: scored.length };
    });
    return ranks;
  }, [geoData]);

  const handleViewChange = useCallback((newZoom, newBounds) => {
    setBounds(newBounds);
  }, []);

  // Clear highlight when selection changes
  useEffect(() => {
    if (!selectedPcode && selectedLayerRef.current) {
      const { layer, feature } = selectedLayerRef.current;
      if (feature.geometry.type === "Point") {
        layer.setStyle({ fillOpacity: 0.85, weight: 2, color: "#fff", radius: LEVEL_RADIUS[feature.properties.adm_level] || 10 });
      } else {
        layer.setStyle(getFeatureStyle(feature));
      }
      selectedLayerRef.current = null;
    }
  }, [selectedPcode]);

  const pointToLayer = useCallback((feature, latlng) => {
    const color = getScoreColor(feature.properties.score);
    const radius = LEVEL_RADIUS[feature.properties.adm_level] || 10;
    return L.circleMarker(latlng, { radius, fillColor: color, color: "#fff", weight: 2, fillOpacity: 0.85 });
  }, []);

  const onEachFeature = useCallback(
    (feature, layer) => {
      const props = feature.properties;
      const r = rankMap[props.pcode];
      layer.bindTooltip(buildTooltipHtml(props, indicator, r?.rank, r?.total), {
        sticky: true,
        direction: "top",
        offset: [0, -8],
        className: "score-tooltip",
      });

      let dblClickTimer = null;

      layer.on({
        mouseover: (e) => {
          const l = e.target;
          if (selectedLayerRef.current?.layer === l) return;
          if (feature.geometry.type === "Point") {
            l.setStyle({ fillOpacity: 1, weight: 3, radius: (LEVEL_RADIUS[props.adm_level] || 10) + 4 });
          } else {
            l.setStyle({ fillOpacity: 0.9, weight: 3, color: "#FFD700" });
          }
          l.bringToFront();
        },
        mouseout: (e) => {
          const l = e.target;
          if (selectedLayerRef.current?.layer === l) return;
          if (feature.geometry.type === "Point") {
            l.setStyle({ fillOpacity: 0.85, weight: 2, color: "#fff", radius: LEVEL_RADIUS[props.adm_level] || 10 });
          } else {
            l.setStyle(getFeatureStyle(feature));
          }
        },
        click: () => {
          if (dblClickTimer) {
            clearTimeout(dblClickTimer);
            dblClickTimer = null;
            return;
          }
          dblClickTimer = setTimeout(() => {
            dblClickTimer = null;

            // Reset previous selection
            if (selectedLayerRef.current) {
              const prev = selectedLayerRef.current;
              if (prev.feature.geometry.type === "Point") {
                prev.layer.setStyle({ fillOpacity: 0.85, weight: 2, color: "#fff", radius: LEVEL_RADIUS[prev.feature.properties.adm_level] || 10 });
              } else {
                prev.layer.setStyle(getFeatureStyle(prev.feature));
              }
            }

            // Highlight clicked
            if (feature.geometry.type === "Point") {
              layer.setStyle({ fillOpacity: 1, weight: 4, color: "#FFD700", radius: (LEVEL_RADIUS[props.adm_level] || 10) + 4 });
            } else {
              layer.setStyle({ fillColor: getScoreColor(props.score), weight: 4, opacity: 1, color: "#FFD700", fillOpacity: 0.8 });
            }
            layer.bringToFront();
            selectedLayerRef.current = { layer, feature };

            selectFeature(props);
          }, 250);
        },
        dblclick: (e) => {
          L.DomEvent.stopPropagation(e);
          if (dblClickTimer) {
            clearTimeout(dblClickTimer);
            dblClickTimer = null;
          }
          if (canDrillDown) {
            drillDown(props.pcode);
          }
        },
      });
    },
    [indicator, rankMap, canDrillDown, selectFeature, drillDown]
  );

  const hasFeatures = geoData?.features?.length > 0;
  const tile = TILE_LAYERS[tileLayer];
  const indicatorLabel = INDICATOR_OPTIONS.find((o) => o.value === indicator)?.label || "CRI";

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-4 py-2 rounded-md shadow-md text-sm text-gray-600">
          Loading scores...
        </div>
      )}

      <MapContainer center={[23.685, 90.3563]} zoom={7} className="w-full h-full" zoomControl={true} doubleClickZoom={false}>
        <TileLayer attribution={tile.attribution} url={tile.url} key={tileLayer} />
        <MapEventHandler onViewChange={handleViewChange} />
        {hasFeatures && <FitBoundsOnData geoData={geoData} />}
        {hasFeatures && (
          <GeoJSON
            key={geoKey}
            ref={geoJsonRef}
            data={geoData}
            style={getFeatureStyle}
            pointToLayer={pointToLayer}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>

      {/* Indicator Selector */}
      <div className="absolute top-4 left-4 z-[1000] flex gap-1 bg-white rounded-lg shadow-md p-1">
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
            {opt.label}
          </button>
        ))}
      </div>

      {/* Navigation Controls */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Layer Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className="bg-white rounded-md shadow-md p-2 hover:bg-gray-50 transition-colors"
            title="Switch map style"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </button>
          {showLayerMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-md shadow-lg py-1 min-w-[120px]">
              {Object.entries(TILE_LAYERS).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => { setTileLayer(key); setShowLayerMenu(false); }}
                  className={`w-full px-3 py-1.5 text-left text-sm ${
                    tileLayer === key ? "bg-[#1B4F72] text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {val.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Drill-up / Reset */}
        {canDrillUp && (
          <button
            onClick={drillUp}
            className="bg-white rounded-md shadow-md p-2 hover:bg-gray-50 transition-colors"
            title="Go back one level"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {canDrillUp && (
          <button
            onClick={resetView}
            className="bg-white rounded-md shadow-md p-2 hover:bg-gray-50 transition-colors"
            title="Reset to divisions"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-6 left-4 z-[1000] bg-white rounded-md shadow-md p-3 min-w-[140px]">
        <h4 className="text-xs font-semibold text-gray-600 mb-2">{indicatorLabel} Score</h4>
        <div className="space-y-1">
          {SCORE_COLORS.map((band) => (
            <div key={band.label} className="flex items-center gap-2">
              <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: band.color }} />
              <span className="text-xs text-gray-700">
                {band.label} ({band.min.toFixed(1)}–{band.max.toFixed(1)})
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-4 h-3 rounded-sm inline-block" style={{ backgroundColor: NO_DATA_COLOR }} />
            <span className="text-xs text-gray-400">No data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
