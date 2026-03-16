import { useState, useEffect, useRef } from "react";
import { getBoundaries } from "../api/geo";
import useDebounce from "./useDebounce";

export default function useGeoData(zoom, bounds) {
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef(new Map());

  const bboxString = bounds
    ? `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`
    : null;

  const debouncedZoom = useDebounce(zoom, 300);
  const debouncedBbox = useDebounce(bboxString, 300);

  useEffect(() => {
    if (debouncedZoom == null) return;

    const cacheKey = `${debouncedZoom}_${debouncedBbox || "all"}`;

    if (cache.current.has(cacheKey)) {
      const cached = cache.current.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
        setGeoData(cached.data);
        return;
      }
    }

    let cancelled = false;
    setLoading(true);

    getBoundaries(debouncedZoom, debouncedBbox)
      .then((res) => {
        if (!cancelled) {
          const data = res.data;
          cache.current.set(cacheKey, { data, timestamp: Date.now() });
          setGeoData(data);
        }
      })
      .catch((err) => {
        if (!cancelled) console.error("Failed to fetch boundaries:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedZoom, debouncedBbox]);

  return { geoData, loading };
}
