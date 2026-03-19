import client from "./client";

export const getScores = (pcode) => client.get(`/scores/${pcode}`);

export const getCalculationTrace = (pcode) =>
  client.get(`/scores/${pcode}/trace`);

export const listScores = (params = {}) =>
  client.get("/scores/list", { params });

export const getScoresMapGeoJSON = (params = {}) =>
  client.get("/scores/map/geojson", { params });

export const getScoresSummary = (params = {}) =>
  client.get("/scores/summary", { params });

export const recomputeAllScores = () => client.post("/scores/recompute");

export const listIndicatorReferences = () => client.get("/scores/reference");

export const updateIndicatorReference = (refId, data) =>
  client.put(`/scores/reference/${refId}`, null, { params: data });
