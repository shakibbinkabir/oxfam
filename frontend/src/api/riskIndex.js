import client from "./client";

export const createRiskIndex = (data) => client.post("/risk-index/", data);

export const updateRiskIndex = (pcode, data) =>
  client.put(`/risk-index/${pcode}`, data);
