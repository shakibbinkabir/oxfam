import client from "./client";

export const runSimulation = (data) => client.post("/simulate", data);

export const listScenarios = (params = {}) =>
  client.get("/scenarios", { params });

export const getScenario = (id) => client.get(`/scenarios/${id}`);

export const createScenario = (data) => client.post("/scenarios", data);

export const deleteScenario = (id) => client.delete(`/scenarios/${id}`);
