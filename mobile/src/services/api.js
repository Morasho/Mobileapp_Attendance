import axios from "axios";
import * as SecureStore from "expo-secure-store";

// Your computer's local IP — phone uses this to reach your backend
const BASE_URL = "http://192.168.100.10:5000/api";

const api = axios.create({ baseURL: BASE_URL });

// Automatically attach JWT token to every request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;