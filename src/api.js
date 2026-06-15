import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import { isTokenExpired } from '@/utils/authSession';

const envApiUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
const baseURL = import.meta.env.DEV
  ? (envApiUrl || 'http://localhost:8000')
  : (envApiUrl || 'https://gabinete.mogidascruzes.sp.gov.br');

const apiClient = axios.create({
  baseURL,
  paramsSerializer: {
    indexes: null,
  },
});

const sanitizeParams = (params) => {
  if (!params || typeof params !== 'object') return params;
  if (params instanceof URLSearchParams) return params;

  const sanitized = Array.isArray(params) ? [] : {};

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.toLowerCase() === 'null' || trimmed.toLowerCase() === 'undefined') return;
      sanitized[key] = trimmed;
      return;
    }
    if (Array.isArray(value)) {
      const filteredArray = value.filter(
        (item) =>
          item !== null &&
          item !== undefined &&
          !(typeof item === 'string' && ['', 'null', 'undefined'].includes(item.trim().toLowerCase()))
      );
      if (filteredArray.length > 0) sanitized[key] = filteredArray;
      return;
    }
    sanitized[key] = value;
  });

  return sanitized;
};

const isAuthEndpoint = (url = '') => (
  url.includes('/api/token/') || url.includes('/api/token/refresh/')
);

let refreshInFlight = null;

async function ensureFreshAccessToken(authStore) {
  if (authStore.accessToken && !isTokenExpired(authStore.accessToken)) {
    return authStore.accessToken;
  }

  if (!authStore.refresh || isTokenExpired(authStore.refresh)) {
    authStore.handleSessionExpired();
    throw new Error('Sessão expirada');
  }

  if (!refreshInFlight) {
    refreshInFlight = authStore.refreshTokenAction()
      .finally(() => {
        refreshInFlight = null;
      });
  }

  await refreshInFlight;
  return authStore.accessToken;
}

apiClient.interceptors.request.use(
  async (config) => {
    const authStore = useAuthStore();
    if (config?.params) {
      config.params = sanitizeParams(config.params);
    }

    const requestUrl = config?.url || '';
    if (config._skipAuthRefresh || isAuthEndpoint(requestUrl)) {
      return config;
    }

    if (!authStore.accessToken && !authStore.refresh) {
      return config;
    }

    try {
      const token = await ensureFreshAccessToken(authStore);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      return Promise.reject(new Error('Sessão expirada'));
    }

    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const authStore = useAuthStore();
    const responseStatus = error?.response?.status;
    const requestUrl = originalRequest?.url || '';

    if (responseStatus === 401 && !originalRequest?._retry && !isAuthEndpoint(requestUrl)) {
      originalRequest._retry = true;

      try {
        await ensureFreshAccessToken(authStore);
        originalRequest.headers.Authorization = `Bearer ${authStore.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        authStore.handleSessionExpired();
        return Promise.reject(refreshError);
      }
    }

    if (responseStatus === 401 && isAuthEndpoint(requestUrl)) {
      authStore.handleSessionExpired();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
