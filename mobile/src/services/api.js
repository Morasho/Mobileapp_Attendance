import axios from "axios";
import * as SecureStore from "expo-secure-store";

const BASE_URL = "https://stammeringly-spaviet-ansley.ngrok-free.dev/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "ngrok-skip-browser-warning": "true",  // tells ngrok to skip the interstitial page
  }
});

// Automatically attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;