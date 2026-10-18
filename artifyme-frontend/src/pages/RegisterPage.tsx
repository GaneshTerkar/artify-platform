import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const category = searchParams.get("category");

  const [selectedRole, setSelectedRole] = useState<"CUSTOMER" | "ARTIST" | "DELIVERY_AGENT">("CUSTOMER");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    address: "",
    phone_number: "",
  });
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const user = await register({ ...form, role: selectedRole });
      if (category && user.role === "CUSTOMER") {
        navigate(`/order?category=${encodeURIComponent(category)}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label key={key} className="block space-y-1 text-sm">
      <span>{label}</span>
      <input
        type={type}
        required
        className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2 text-white"
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );

  return (
    <div className="max-w-md mx-auto w-full">
      {category && (
        <div className="mb-6 rounded-xl border border-brand/40 bg-brand/10 p-3.5 text-center text-sm">
          <p className="font-semibold text-white">Ordering a {category} portrait sketch</p>
          <p className="text-xs text-slate-300 mt-1">Create an account to complete your custom order.</p>
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Create account</h1>
          <p className="text-xs text-slate-400 mt-0.5">Select your role to get started on ArtifyMe</p>
        </div>

        {/* Role Selector Tabs */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setSelectedRole("CUSTOMER")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition text-center ${
              selectedRole === "CUSTOMER"
                ? "bg-brand text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            👤 Customer
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("ARTIST")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition text-center ${
              selectedRole === "ARTIST"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🎨 Artist
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("DELIVERY_AGENT")}
            className={`py-2 px-1 text-xs font-semibold rounded-lg transition text-center ${
              selectedRole === "DELIVERY_AGENT"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🚚 Courier
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {field("full_name", "Full name")}
        {field("email", "Email", "email")}
        {field("password", "Password (min 8)", "password")}
        {field("address", selectedRole === "DELIVERY_AGENT" ? "Logistics hub / Operating address" : "Delivery address")}
        {field("phone_number", "Phone")}
        <button type="submit" className="w-full rounded-xl bg-brand py-3 font-medium text-white hover:opacity-90">
          Register & continue
        </button>
        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            to={category ? `/login?category=${encodeURIComponent(category)}` : "/login"}
            className="text-brand font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
