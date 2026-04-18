import React, { createContext, useContext, useState, useCallback } from "react";
import type { User } from "../api/types";

interface LoginResult {
  token: string;
  user: User;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateToken: (token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("ir_os_token")
  );
  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem("ir_os_user");
      return u ? (JSON.parse(u) as User) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Login failed");
    }
    const data = (await res.json()) as LoginResult;
    localStorage.setItem("ir_os_token", data.token);
    localStorage.setItem("ir_os_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ir_os_token");
    localStorage.removeItem("ir_os_user");
    setToken(null);
    setUser(null);
  }, []);

  const updateToken = useCallback((newToken: string) => {
    localStorage.setItem("ir_os_token", newToken);
    setToken(newToken);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
