import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authMe } from "./api";

const AuthContext = createContext(null);

const STORAGE_KEY = "crm_auth_token";

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);

  const login = useCallback((nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(STORAGE_KEY, nextToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return undefined;
    }
    let cancelled = false;
    authMe()
      .then((profile) => {
        if (!cancelled) {
          setUser(profile);
        }
      })
      .catch(() => {
        if (!cancelled) {
          logout();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, logout]);

  const role = user?.role?.toLowerCase?.() ?? null;
  const value = useMemo(
    () => ({
      token,
      user,
      setUser,
      login,
      logout,
      role,
      isAdmin: role === "admin",
      isManager: role === "manager",
      authReady: Boolean(token && user),
    }),
    [token, user, role, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

export const getStoredToken = () => localStorage.getItem(STORAGE_KEY);
