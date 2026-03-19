import client from "./client";

export const exportCsv = (params = {}) =>
  client.get("/export/csv", { params, responseType: "blob" });

export const exportPdf = (boundaryPcode, lang = "en") =>
  client.get("/export/pdf", {
    params: { boundary_pcode: boundaryPcode, lang },
    responseType: "blob",
  });

export const exportShapefile = (params = {}) =>
  client.get("/export/shapefile", { params, responseType: "blob" });
