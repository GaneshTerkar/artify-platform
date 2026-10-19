import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const loggedUser = await login(email, password);
      if (category && loggedUser.role === "CUSTOMER") {
        navigate(`/order?category=${encodeURIComponent(category)}`);
      } else if (loggedUser.role === "ADMIN") {
        navigate("/admin?tab=fixtures");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  function fillCredentials(fillEmail: string, fillPass: string = "Password123!") {
    setEmail(fillEmail);
    setPassword(fillPass);
    setError("");
  }

  return (
    <div className="max-w-md mx-auto w-full space-y-6">
      {/* 1-Click Testing Helper for Admin */}
      <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🧪</span>
            <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
              Quick Admin &amp; Test Login
            </span>
          </div>
          <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-mono">
            Password: Password123!
          </span>
        </div>

        <p className="text-xs text-slate-300">
          Click below to 1-click populate credentials for end-to-end multi-role testing:
        </p>

        <div className="grid grid-cols-1 gap-2 pt-1">
          <button
            type="button"
            onClick={() => fillCredentials("testadmin2@artifyme.com")}
            className="w-full text-left rounded-xl bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/40 p-2.5 transition flex items-center justify-between group"
          >
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>👑</span>
                <span>Admin Tester (Omni-Role)</span>
              </div>
              <div className="text-[11px] text-purple-300 font-mono">testadmin2@artifyme.com</div>
            </div>
            <span className="text-xs text-purple-300 font-semibold group-hover:translate-x-0.5 transition-transform">
              Fill &rarr;
            </span>
          </button>

          <button
            type="button"
            onClick={() => fillCredentials("terkarganesh2709@gmail.com")}
            className="w-full text-left rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 p-2.5 transition flex items-center justify-between group"
          >
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>👑</span>
                <span>Ganesh Terkar (Admin)</span>
              </div>
              <div className="text-[11px] text-slate-300 font-mono">terkarganesh2709@gmail.com</div>
            </div>
            <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">
              Fill &rarr;
            </span>
          </button>
        </div>
      </div>

      {category && (
        <div className="rounded-xl border border-brand/40 bg-brand/10 p-3.5 text-center text-sm">
          <p className="font-semibold text-white">Ordering a {category} portrait sketch</p>
          <p className="text-xs text-slate-300 mt-1">Please sign in to continue placing your order.</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button type="submit" className="w-full rounded-xl bg-brand py-3 font-medium text-white hover:opacity-90">
          Continue
        </button>
        <p className="text-center text-sm text-slate-400">
          New here?{" "}
          <Link
            to={category ? `/register?category=${encodeURIComponent(category)}` : "/register"}
            className="text-brand font-medium hover:underline"
          >
            Create account
          </Link>
        </p>
      </form>
    </div>
  );
}
