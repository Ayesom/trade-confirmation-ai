import axios from "axios";

const API = axios.create({ baseURL: "/api" });

export const searchTemplates = (query, tradeType, topK = 3) =>
  API.get("/templates/search", { params: { query, trade_type: tradeType, top_k: topK } });

export const searchByFile = (formData) =>
  API.post("/templates/search-by-file", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const getAllTemplates = () => API.get("/templates/all");
export const getTradeTypes = () => API.get("/templates/trade-types");
export const getClauseLibrary = (tradeType) =>
  API.get("/templates/clause-library", { params: { trade_type: tradeType } });

export const runDiff = (template, newTrade) =>
  API.post("/diff/compare", { template, new_trade: newTrade });

export const generateConfirmation = (tradeData, template) =>
  API.post("/generate/confirmation", { trade_data: tradeData, template });

export const exportConfirmation = async (confirmation, format) => {
  const response = await API.post("/generate/export", { confirmation, format }, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `${confirmation.id || "confirmation"}.${format}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export const getMetrics = () => API.get("/metrics/dashboard");
export const seedTemplates = () => API.get("/templates/seed");

export default API;