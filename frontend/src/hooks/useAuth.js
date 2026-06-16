/**
 * useAuth - Authentication state + Google OAuth flow
 *
 * WBS Tasks 8.2, 7.7 (merge trigger)
 */

import { useCallback, useEffect, useState } from 'react';
import { authApi, setAuthenticatedSession } from '../services/api.js';
import { getGuestUuid, clearGuestUuid } from '../services/guestStorage.js';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isActive = true;

    authApi.getMe()
      .then((res) => {
        if (!isActive) return;
        setAuthenticatedSession(true);
        setUser(res.data);
      })
      .catch(() => {
        if (!isActive) return;
        setAuthenticatedSession(false);
        setUser(null);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const triggerMerge = useCallback(async () => {
    const guestUuid = getGuestUuid();
    if (!guestUuid) return null;

    try {
      const res = await authApi.mergeGuest(guestUuid);
      clearGuestUuid();
      return res.data;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(async (code, redirectUri) => {
    setError(null);
    setIsLoading(true);

    try {
      const res = await authApi.googleLogin(code, redirectUri);
      setAuthenticatedSession(true);
      setUser(res.data.user);

      const mergeResult = await triggerMerge();
      if (mergeResult?.stats) {
        setUser((prev) => prev ? {
          ...prev,
          currentStreak: mergeResult.stats.currentStreak,
          maxStreak: mergeResult.stats.maxStreak,
        } : prev);
      }

      return { ...res.data, mergeResult };
    } catch (err) {
      const msg = err.response?.data?.error?.message || 'Login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [triggerMerge]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAuthenticatedSession(false);
      setUser(null);
    }
  }, []);

  return { user, isLoading, error, login, logout, triggerMerge };
}
