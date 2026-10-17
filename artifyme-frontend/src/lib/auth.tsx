import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

type User = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => void;
};

type RegisterPayload = {
  full_name: string;
  email: string;
  password: string;
  address: string;
  phone_number: string;
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

  const persist = useCallback((t: string, u: User) => {
    localStorage.setItem("artify_token", t);
    localStorage.setItem("artify_user", JSON.stringify(u));
    setToken(t);
    setUser(u);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ Token: string; User: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      persist(res.Token, res.User);
    },
    [persist],
  );

  const register = useCallback(
    async (payload: RegisterPayload) => {
      await api("/auth/register", {
        method: "POST",
        body: JSON.stringify({ ...payload, role: "CUSTOMER" }),
      });
      await login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem("artify_token");
    localStorage.removeItem("artify_user");
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, token, login, register, logout }),
    [user, token, login, register, logout],
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
