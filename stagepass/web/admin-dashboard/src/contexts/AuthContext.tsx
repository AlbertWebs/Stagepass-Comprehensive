import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setToken, type User } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState & {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (t: string) => {
    setToken(t);
    const u = await api.auth.me();
    setUser(u);
    setTokenState(t);
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('stagepass_admin_token');
    if (t) {
      loadUser(t).catch(() => {
        setToken(null);
        setTokenState(null);
        setUser(null);
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setToken(res.token);
    setUser(res.user);
    setTokenState(res.token);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    setToken(null);
    setTokenState(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const t = localStorage.getItem('stagepass_admin_token');
    if (t) {
      try {
        const u = await api.auth.me();
        setUser(u);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
