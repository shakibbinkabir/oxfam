import client from "./client";

export const getBoundaries = (zoom, bbox) => {
  const params = { zoom };
  if (bbox) params.bbox = bbox;
  return client.get("/geo/boundaries", { params });
};

export const getDivisions = () => client.get("/geo/divisions");

export const getDistricts = (divisionPcode) => {
  const params = divisionPcode ? { division_pcode: divisionPcode } : {};
  return client.get("/geo/districts", { params });
};

export const getUpazilas = (districtPcode) => {
  const params = districtPcode ? { district_pcode: districtPcode } : {};
  return client.get("/geo/upazilas", { params });
};

export const getUnions = (upazilaPcode) => {
  const params = upazilaPcode ? { upazila_pcode: upazilaPcode } : {};
  return client.get("/geo/unions", { params });
};

export const getUnionDetail = (pcode) => client.get(`/geo/unions/${pcode}`);

export const getGeoStats = () => client.get("/geo/stats");
