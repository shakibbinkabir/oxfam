import client from "./client";

export const listIndicators = (params = {}) =>
  client.get("/indicators", { params });

export const getIndicator = (id) => client.get(`/indicators/${id}`);

export const createIndicator = (data) => client.post("/indicators", data);

export const updateIndicator = (id, data) =>
  client.put(`/indicators/${id}`, data);

export const deleteIndicator = (id) => client.delete(`/indicators/${id}`);

export const exportIndicators = (format = "csv") =>
  client.get("/indicators/export", {
    params: { format },
    responseType: format === "csv" ? "blob" : "json",
  });

export const getIndicatorValuesByBoundary = (pcode) =>
  client.get(`/indicators/values/by-boundary/${pcode}`);

export const submitIndicatorValue = (data) =>
  client.post("/indicators/values", data);

export const deleteIndicatorValue = (id) =>
  client.delete(`/indicators/values/${id}`);
