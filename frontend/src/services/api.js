/**
 * Axios API Client - Centralized typed HTTP client
 *
 * WBS Task 8.1
 * - withCredentials: true  -> sends httpOnly cookies (access_token, refresh_token)
 * - X-Guest-ID header      -> injected only after guest mode is confirmed
 * - Automatic token refresh on 401 (single-retry with refresh rotation)
 */

import axios from 'axios';
import { getGuestUuid } from './guestStorage.js';

const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

let hasResolvedAuthSession = false;
let isAuthenticatedSession = false;

export function setAuthenticatedSession(isAuthenticated) {
  hasResolvedAuthSession = true;
  isAuthenticatedSession = Boolean(isAuthenticated);
}

function isAuthEndpoint(url = '') {
  return url.includes('/api/auth/');
}

api.interceptors.request.use((config) => {
  if (!isAuthEndpoint(config.url) && hasResolvedAuthSession && !isAuthenticatedSession) {
    const guestUuid = getGuestUuid();
    config.headers = config.headers || {};
    config.headers['X-Guest-ID'] = guestUuid;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

function onTokenRefreshed() {
  refreshSubscribers.forEach((cb) => cb());
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/refresh')
    ) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push(() => resolve(api(originalRequest)));
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/api/auth/refresh');
        onTokenRefreshed();
        return api(originalRequest);
      } catch (refreshError) {
        refreshSubscribers = [];
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  /** Exchange Google OAuth code for JWT tokens */
  googleLogin: (code, redirectUri) =>
    api.post('/api/auth/google', { code, redirectUri }),

  /** Rotate access token using refresh_token cookie */
  refresh: () => api.post('/api/auth/refresh'),

  /** Merge guest data into authenticated user */
  mergeGuest: (guestUuid) =>
    api.post('/api/auth/merge', { guestUuid }),

  /** Revoke tokens and clear cookies */
  logout: () => api.post('/api/auth/logout'),

  /** Get current user profile */
  getMe: () => api.get('/api/auth/me'),
};

export const gameApi = {
  /** Load today's daily game (returns Base64 word + progress) */
  getToday: () => api.get('/api/game/today'),

  /**
   * Sync guess state to the server (debounced by the caller).
   * @param {{ id: string, guesses: string[], status: 'PLAYING'|'WON'|'LOST' }} dto
   */
  sync: (dto) => api.post('/api/game/sync', dto),
};

export const statsApi = {
  /** Load authenticated player's derived stats */
  getMyStats: () => api.get('/api/stats/me'),

  /** Load public top-streak leaderboard */
  getLeaderboard: () => api.get('/api/leaderboard'),
};
