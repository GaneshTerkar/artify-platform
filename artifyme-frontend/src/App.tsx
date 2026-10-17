import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import OrderSuccessPage from "./pages/OrderSuccessPage";
import OrderWizardPage from "./pages/OrderWizardPage";
import RegisterPage from "./pages/RegisterPage";

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-12 pt-6">
      <header className="mb-8 flex items-center justify-between border-b border-slate-800 pb-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <span className="text-brand">✦</span> ArtifyMe
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user?.role !== "ADMIN" && (
            <Link
              to="/order"
              className="rounded-lg bg-brand/15 border border-brand/40 px-3 py-1.5 text-brand font-medium hover:bg-brand hover:text-white transition"
            >
              Order Sketch
            </Link>
          )}
          {user ? (
            <>
              {user.role === "ADMIN" && (
                <>
                  <Link
                    to="/admin?tab=orders"
                    className="text-slate-300 hover:text-white transition"
                  >
                    Orders
                  </Link>
                  <Link
                    to="/admin?tab=users"
                    className="text-slate-300 hover:text-white transition"
                  >
                    Users
                  </Link>
                </>
              )}
              {user.role !== "ADMIN" && (
                <Link to="/account" className="text-slate-300 hover:text-white transition">
                  {user.role === "ARTIST" ? "🎨 My Commissions" : "Orders"}
                </Link>
              )}
              <button
                type="button"
                onClick={logout}
                className="text-slate-400 hover:text-white transition"
              >
                Log out
              </button>
            </>
          ) : (
            <Link to="/login" className="text-brand hover:underline transition">
              Sign in
            </Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.role === "ADMIN") return <Navigate to="/admin" replace />;
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
      <Routes>
        <Route path="/" element={<HomePage />} />
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
    </Shell>
  );
}

