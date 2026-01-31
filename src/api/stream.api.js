const API_URL = "http://localhost:5000";

export const healthCheck = async () => {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
};
