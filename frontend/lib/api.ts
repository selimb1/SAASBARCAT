import axios from "axios";
import Cookies from "js-cookie";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: agrega JWT
api.interceptors.request.use((config) => {
  const token = Cookies.get("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Response interceptor: refresh automático
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = Cookies.get("refresh_token");

      if (refreshToken) {
        try {
          const res = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const { access_token, refresh_token } = res.data;
          Cookies.set("access_token", access_token, { expires: 1 / 96 }); // 15 min
          Cookies.set("refresh_token", refresh_token, { expires: 7 });
          
          processQueue(null, access_token);
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (err) {
          processQueue(err, null);
          Cookies.remove("access_token");
          Cookies.remove("refresh_token");
          window.location.href = "/login";
          return Promise.reject(err);
        } finally {
          isRefreshing = false;
        }
      }
    }
    return Promise.reject(error);
  }
);

// Upload multipart
export const apiUpload = (url: string, formData: FormData, onProgress?: (pct: number) => void) =>
  api.post(url, formData, {
    headers: { "Content-Type": "multipart/form-data" },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
