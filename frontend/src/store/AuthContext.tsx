import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { getAccessToken, setAccessToken } from '../lib/token';
import type { Admin } from '../types';

interface AuthContextValue {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setAdmin: (admin: Admin | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdminState] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!getAccessToken()) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        if (active) setAdminState(res.data.data as Admin);
      } catch {
        if (active) setAdminState(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, admin: adminData } = res.data.data as { accessToken: string; admin: Admin };
    setAccessToken(accessToken);
    setAdminState(adminData);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors on logout
    }
    setAccessToken(null);
    setAdminState(null);
  }, []);

  const setAdmin = useCallback((next: Admin | null) => setAdminState(next), []);

  const value = useMemo(
    () => ({ admin, loading, login, logout, setAdmin }),
    [admin, loading, login, logout, setAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
