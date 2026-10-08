import axios from 'axios';

// All requests go to /api (proxied to the backend in dev, same server in production).
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

const KEYS = { access: 'clinic_access', refresh: 'clinic_refresh', user: 'clinic_user' };

export const session = {
  get user() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.user));
    } catch {
      return null;
    }
  },
  save({ user, accessToken, refreshToken }) {
    if (user) localStorage.setItem(KEYS.user, JSON.stringify(user));
    if (accessToken) localStorage.setItem(KEYS.access, accessToken);
    if (refreshToken) localStorage.setItem(KEYS.refresh, refreshToken);
  },
  clear() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },
  get access() {
    return localStorage.getItem(KEYS.access);
  },
  get refresh() {
    return localStorage.getItem(KEYS.refresh);
  },
};

api.interceptors.request.use((config) => {
  if (session.access) config.headers.Authorization = `Bearer ${session.access}`;
  return config;
});

// If the access token expired, silently get a new one with the refresh token and retry once.
let refreshing = null;
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !original._retry && !isAuthCall && session.refresh) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          axios.post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: session.refresh }).finally(() => {
            refreshing = null;
          });
        const { data } = await refreshing;
        session.save(data.data);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return api(original);
      } catch {
        session.clear();
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export function errorMessage(err) {
  const body = err.response?.data;
  if (body?.details?.length) return body.details.map((d) => `${d.field}: ${d.message}`).join(', ');
  return body?.message || err.message || 'Something went wrong';
}

export default api;
