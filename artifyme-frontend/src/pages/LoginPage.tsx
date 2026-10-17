import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");
  const redirectTarget = category ? `/order?category=${encodeURIComponent(category)}` : "/order";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await login(email, password);
      navigate(redirectTarget);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="max-w-md mx-auto w-full">
      {category && (
        <div className="mb-6 rounded-xl border border-brand/40 bg-brand/10 p-3.5 text-center text-sm">
          <p className="font-semibold text-white">Ordering a {category} portrait sketch</p>
          <p className="text-xs text-slate-300 mt-1">Please sign in to continue placing your order.</p>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
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
