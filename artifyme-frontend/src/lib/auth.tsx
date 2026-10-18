import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api, getDeviceInfo, setTokens, clearTokens } from "./api";

export type User = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  phone_number?: string;
  address?: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  register: (payload: RegisterPayload) => Promise<User>;
  updateUser: (updatedFields: Partial<User>) => void;
  logout: () => void;
};

type RegisterPayload = {
  full_name: string;
  email: string;
  password: string;
  address: string;
  phone_number: string;
  role?: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("artify_token"),
  );
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("artify_user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const persist = useCallback((t: string, u: User, rt?: string) => {
    setTokens(t, rt);
    localStorage.setItem("artify_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const deviceInfo = getDeviceInfo();
      const res = await api<{
        token?: string;
        Token?: string;
        refresh_token?: string;
        user?: User;
        User?: User;
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          device_id: deviceInfo.device_id,
          device_name: deviceInfo.device_name,
          device_type: deviceInfo.device_type,
        }),
      });

      const authToken = res.token || res.Token;
      const authUser = res.user || res.User;
      if (!authToken || !authUser) {
        throw new Error("Invalid response received from authentication server");
      }

      persist(authToken, authUser, res.refresh_token);
      return authUser;
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ role: "CUSTOMER", ...payload }),
      });
      return await login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    clearTokens();
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    const onSessionExpired = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener("artify:session_expired", onSessionExpired);
    return () => window.removeEventListener("artify:session_expired", onSessionExpired);
  }, []);

  const updateUser = useCallback((updatedFields: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, ...updatedFields };
      localStorage.setItem("artify_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const value = useMemo(
    () => ({ user, token, login, register, updateUser, logout }),
    [user, token, login, register, updateUser, logout],
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
