import client from "./client";

export const listUnits = (params = {}) =>
  client.get("/units", { params });

export const createUnit = (data) => client.post("/units", data);

export const updateUnit = (id, data) => client.put(`/units/${id}`, data);

export const deleteUnit = (id) => client.delete(`/units/${id}`);
