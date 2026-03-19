import { useState, useEffect, useCallback } from "react";
import { getScores, getCalculationTrace } from "../api/scores";

export default function useScores(pcode) {
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchScores = useCallback(async () => {
    if (!pcode) {
      setScores(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getScores(pcode);
      setScores(res.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch scores");
      setScores(null);
    } finally {
      setLoading(false);
    }
  }, [pcode]);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  return { scores, loading, error, refetch: fetchScores };
}

export function useCalculationTrace(pcode) {
  const [trace, setTrace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTrace = useCallback(async () => {
    if (!pcode) {
      setTrace(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await getCalculationTrace(pcode);
      setTrace(res.data.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to fetch trace");
      setTrace(null);
    } finally {
      setLoading(false);
    }
  }, [pcode]);

  useEffect(() => {
    fetchTrace();
  }, [fetchTrace]);

  return { trace, loading, error, refetch: fetchTrace };
}
