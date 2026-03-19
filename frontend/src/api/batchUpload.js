import client from "./client";

export function createBatchUpload(file) {
  const formData = new FormData();
  formData.append("file", file);
  return client.post("/batch-upload/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

export function getBatchJobStatus(jobId) {
  return client.get(`/batch-upload/${jobId}/status`);
}

export function listBatchJobs() {
  return client.get("/batch-upload/");
}
