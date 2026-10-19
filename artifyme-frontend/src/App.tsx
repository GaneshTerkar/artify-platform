import React, { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import Footer from "./components/Footer";
import ProfileModal from "./components/ProfileModal";
import ContactPage from "./pages/ContactPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import OrderWizardPage from "./pages/OrderWizardPage";
import RegisterPage from "./pages/RegisterPage";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ArtifyMe UI Crash Caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center space-y-4 my-8">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-xl font-bold text-rose-300">Something went wrong</h2>
          <p className="text-sm text-slate-300 max-w-md mx-auto">
            {this.state.error?.message || "An unexpected error occurred while rendering this page."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function UserProfileDropdown({
  user,
  onLogout,
  onOpenProfile,
}: {
  user: { full_name: string; email: string; role: string };
  onLogout: () => void;
  onOpenProfile: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const initials = user.full_name
    ? user.full_name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  const roleLabel =
    user.role === "ADMIN"
      ? "Administrator"
      : user.role === "ARTIST"
      ? "Master Artist"
      : user.role === "DELIVERY_AGENT"
      ? "Delivery Partner"
      : "Customer";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 px-3 py-1.5 text-xs sm:text-sm font-medium text-white transition shadow-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
        aria-expanded={isOpen}
      >
        <span className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 via-pink-500 to-amber-400 text-slate-950 font-extrabold flex items-center justify-center text-[10px] shadow-sm">
          {initials}
        </span>
        <span className="max-w-[120px] sm:max-w-[150px] truncate font-semibold text-white">
          {user.full_name}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-white" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-slate-700/90 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1">
            <p className="text-xs font-bold text-white truncate">{user.full_name}</p>
            <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
            <div className="pt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="my-1.5 border-t border-slate-800/80" />

          {/* Role-Specific Navigation Options */}
          <div className="space-y-0.5 text-xs">
            {/* Customer: My Orders, Profile, Log Out */}
            {user.role === "CUSTOMER" && (
              <>
                <Link
                  to="/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">📦</span>
                  <span>My Orders</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium text-left"
                >
                  <span className="text-sm">👤</span>
                  <span>Profile</span>
                </button>
              </>
            )}

            {/* Admin Omni-Testing Options: Switch perspectives or jump to hubs */}
            {user.role === "ADMIN" && (
              <>
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-amber-400/90">
                  ⚡ Testing Perspectives
                </div>
                <Link
                  to="/order"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🛍️</span>
                  <span>Order Custom Art (Wizard)</span>
                </Link>
                <Link
                  to="/account?perspective=customer"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">📦</span>
                  <span>Customer Commissions & Review</span>
                </Link>
                <Link
                  to="/account?perspective=artist"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🎨</span>
                  <span>Artist Studio & Upload Work</span>
                </Link>
                <Link
                  to="/account?perspective=delivery"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🚚</span>
                  <span>Delivery Agent Logistics</span>
                </Link>
                <div className="my-1 border-t border-slate-800" />
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  👑 Admin Operations
                </div>
                <Link
                  to="/admin?tab=orders"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">📋</span>
                  <span>Orders & Logistics</span>
                </Link>
                <Link
                  to="/admin?tab=reviews"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">⭐</span>
                  <span>CSAT & Reviews</span>
                </Link>
                <Link
                  to="/admin?tab=fixtures"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🧪</span>
                  <span>Sample Art Fixtures Lab</span>
                </Link>
                <Link
                  to="/admin?tab=users"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">👥</span>
                  <span>Users & Artists</span>
                </Link>
                <Link
                  to="/admin?tab=payroll"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">💰</span>
                  <span>Payroll</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium text-left"
                >
                  <span className="text-sm">👤</span>
                  <span>Profile</span>
                </button>
              </>
            )}

            {/* Artist: My Commissions, Portfolio, Profile, Log Out */}
            {user.role === "ARTIST" && (
              <>
                <Link
                  to="/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🎨</span>
                  <span>My Commissions</span>
                </Link>
                <Link
                  to="/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🖼️</span>
                  <span>Portfolio</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium text-left"
                >
                  <span className="text-sm">👤</span>
                  <span>Profile</span>
                </button>
              </>
            )}

            {/* Delivery Agent: My Deliveries, Profile, Log Out */}
            {user.role === "DELIVERY_AGENT" && (
              <>
                <Link
                  to="/account"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium"
                >
                  <span className="text-sm">🚚</span>
                  <span>My Deliveries</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white transition font-medium text-left"
                >
                  <span className="text-sm">👤</span>
                  <span>Profile</span>
                </button>
              </>
            )}
          </div>

          <div className="my-1.5 border-t border-slate-800/80" />

          {/* Log Out Option */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/15 hover:text-rose-200 transition text-left"
          >
            <span className="text-sm">🚪</span>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const currentPerspective = searchParams.get("perspective");

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-12 pt-6">
      <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800 pb-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5 group">
          <img
            src="/artifyme-icon.png"
            alt="ArtifyMe"
            className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-white/10 group-hover:scale-105 transition"
          />
          <span className="font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
            ArtifyMe
          </span>
        </Link>
        <nav className="flex flex-wrap items-center justify-start sm:justify-end gap-2 sm:gap-3 text-xs sm:text-sm">
          {user?.role !== "ADMIN" && (
            <Link to="/contact" className="text-slate-300 hover:text-white transition font-medium">
              Contact Us
            </Link>
          )}
          {user ? (
            <>
              {user.role === "ADMIN" && (
                <>
                  <Link
                    to="/order"
                    className="text-cyan-300 hover:text-cyan-200 transition font-semibold flex items-center gap-1"
                  >
                    <span>+</span> Order Custom Art
                  </Link>
                  <Link
                    to="/admin?tab=orders"
                    className="text-slate-300 hover:text-white transition font-medium"
                  >
                    Orders
                  </Link>
                  <Link
                    to="/admin?tab=reviews"
                    className="text-slate-300 hover:text-white transition font-medium"
                  >
                    CSAT
                  </Link>
                  <Link
                    to="/admin?tab=fixtures"
                    className="text-slate-300 hover:text-white transition font-medium"
                  >
                    Test Lab
                  </Link>
                  <Link
                    to="/admin?tab=users"
                    className="text-slate-300 hover:text-white transition font-medium"
                  >
                    Users
                  </Link>
                  <Link
                    to="/admin?tab=payroll"
                    className="text-slate-300 hover:text-white transition font-medium"
                  >
                    Payroll
                  </Link>
                </>
              )}
              {user.role !== "ADMIN" && (
                <Link to="/account" className="text-slate-300 hover:text-white transition font-medium">
                  {user.role === "ARTIST"
                    ? "🎨 My Commissions"
                    : user.role === "DELIVERY_AGENT"
                    ? "🚚 My Deliveries"
                    : "My Orders"}
                </Link>
              )}
              <UserProfileDropdown
                user={user}
                onLogout={logout}
                onOpenProfile={() => setIsProfileOpen(true)}
              />
            </>
          ) : (
            <Link to="/login" className="text-slate-300 hover:text-white transition font-medium">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      {/* Admin Omni-Perspective Testing Mode Switcher Bar */}
      {user?.role === "ADMIN" && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-amber-950/40 p-3 sm:p-3.5 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" />
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300 block">
                Single-Login Omni-Perspective Hub
              </span>
              <span className="text-[11px] text-slate-300">
                Experience full flows as Customer, Artist, Delivery Agent, and Admin
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Link
              to="/admin"
              className={`rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                location.pathname === "/admin"
                  ? "bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400/30"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80"
              }`}
            >
              <span>👑</span>
              <span>Admin Hub</span>
            </Link>
            <Link
              to="/order"
              className={`rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                location.pathname === "/order"
                  ? "bg-cyan-500 text-slate-950 shadow-md ring-2 ring-cyan-400/30"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80"
              }`}
            >
              <span>🛍️</span>
              <span>Customer Order</span>
            </Link>
            <Link
              to="/account?perspective=artist"
              className={`rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                location.pathname === "/account" && currentPerspective === "artist"
                  ? "bg-purple-500 text-slate-950 shadow-md ring-2 ring-purple-400/30"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80"
              }`}
            >
              <span>🎨</span>
              <span>Artist Studio</span>
            </Link>
            <Link
              to="/account?perspective=delivery"
              className={`rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                location.pathname === "/account" && currentPerspective === "delivery"
                  ? "bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-400/30"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80"
              }`}
            >
              <span>🚚</span>
              <span>Delivery Partner</span>
            </Link>
            <Link
              to="/account?perspective=customer"
              className={`rounded-xl px-3 py-1.5 font-bold transition flex items-center gap-1.5 ${
                location.pathname === "/account" && (currentPerspective === "customer" || !currentPerspective)
                  ? "bg-blue-500 text-slate-950 shadow-md ring-2 ring-blue-400/30"
                  : "bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/80"
              }`}
            >
              <span>📦</span>
              <span>Customer Orders</span>
            </Link>
          </div>
        </div>
      )}

      <main className="flex-1">
        {children}
      </main>
      {user?.role !== "ADMIN" && <Footer />}
      {user && (
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      )}
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Shell>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/order"
            element={
              <CustomerRoute>
                <OrderWizardPage />
              </CustomerRoute>
            }
          />
          <Route path="/order/success" element={<OrderSuccessPage />} />
          <Route
            path="/account"
            element={
              <PrivateRoute>
                <AccountPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
        </Routes>
      </ErrorBoundary>
    </Shell>
  );
}

