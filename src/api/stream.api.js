const API_URL = "https://backend-video-meet-1.onrender.com";

export const healthCheck = async () => {
  const res = await fetch(`${API_URL}/health`);
  return res.json();
};
