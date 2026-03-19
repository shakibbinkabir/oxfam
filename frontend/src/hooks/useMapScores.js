import { useState, useEffect, useRef } from "react";
import { getScoresMapGeoJSON } from "../api/scores";
import useDebounce from "./useDebounce";

export default function useMapScores(level, indicator = "cri", bounds) {
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map());

  const bboxString = bounds
    ? `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`
    : null;

  const debouncedLevel = useDebounce(level, 300);
  const debouncedBbox = useDebounce(bboxString, 300);
  const debouncedIndicator = useDebounce(indicator, 300);

  useEffect(() => {
    if (debouncedLevel == null) return;

    const cacheKey = `${debouncedLevel}_${debouncedIndicator}_${debouncedBbox || "all"}`;

    if (cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setGeoData(cached.data);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);

    const params = { level: debouncedLevel, indicator: debouncedIndicator };
    if (debouncedBbox) params.bbox = debouncedBbox;

    getScoresMapGeoJSON(params)
      .then((res) => {
        if (!cancelled) {
          const data = res.data;
          cache.current.set(cacheKey, { data, timestamp: Date.now() });
          setGeoData(data);
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to fetch map scores:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedLevel, debouncedIndicator, debouncedBbox]);

  return { geoData, loading };
}
