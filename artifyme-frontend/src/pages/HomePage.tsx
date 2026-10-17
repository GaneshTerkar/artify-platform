import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Painting } from "../types/order";

const CATEGORIES = [
  { id: "ALL", label: "All Paintings" },
  { id: "PENCIL", label: "Pencil Sketch" },
  { id: "CHARCOAL", label: "Charcoal" },
  { id: "WATERCOLOR", label: "Watercolor" },
  { id: "ACRYLIC", label: "Acrylic" },
  { id: "OIL", label: "Oil Painting" },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("ALL");
  const [selectedPainting, setSelectedPainting] = useState<Painting | null>(null);
  const [authPromptPainting, setAuthPromptPainting] = useState<Painting | null>(null);

  // Fetch catalog of existing paintings from backend
  const { data, isLoading } = useQuery({
    queryKey: ["paintings"],
    queryFn: () => api<{ paintings: Painting[] }>("/api/v1/paintings"),
  });

  const paintings = data?.paintings ?? [];

  const filteredPaintings = useMemo(() => {
    if (activeCategory === "ALL") return paintings;
    return paintings.filter((p) => p.category === activeCategory);
  }, [paintings, activeCategory]);

  function handleOrderClick(painting: Painting) {
    if (user) {
      // User is already authenticated: proceed directly to order wizard
      navigate(`/order?category=${painting.category}`);
    } else {
      // Prompt user whether they are an existing customer (Sign in) or new customer (Register)
      setAuthPromptPainting(painting);
    }
  }

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: paintings.length };
    for (const p of paintings) {
      counts[p.category] = (counts[p.category] || 0) + 1;
    }
    return counts;
  }, [paintings]);

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-muted via-slate-900 to-brand-dark p-6 sm:p-10 border border-slate-700/60 shadow-xl">
        <div className="max-w-2xl space-y-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/20 border border-brand/30 px-3 py-1 text-xs font-semibold text-brand tracking-wide uppercase">
            Handmade Portrait Gallery
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Original Hand-Drawn & Painted Portrait Sketches
          </h1>
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Explore authentic hand-drawn portraits created by our master artists. Pick your favorite style—from
            detailed pencil sketches to rich oil paintings—and order your personalized sketch today.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            {user?.role === "ADMIN" ? (
              <Link
                to="/admin"
                className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black shadow-lg shadow-amber-500/30 hover:opacity-90 transition flex items-center gap-2"
              >
                <span>🛡️</span> Open Admin Portal
              </Link>
            ) : (
              <Link
                to="/order"
                className="rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/30 hover:opacity-90 transition"
              >
                Order Custom Sketch
              </Link>
            )}
            <a
              href="#gallery"
              className="rounded-xl border border-slate-600 bg-slate-800/60 px-5 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700/60 transition"
            >
              Browse Category Gallery ↓
            </a>
          </div>
        </div>
      </section>

      {/* Gallery Section */}
      <section id="gallery" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Featured Artworks by Category</h2>
            <p className="text-sm text-slate-400 mt-1">
              Select a category below to filter paintings and start your custom commission.
            </p>
          </div>
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{filteredPaintings.length}</strong> artwork{filteredPaintings.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? "bg-brand text-white shadow-md shadow-brand/20"
                    : "border border-slate-700 bg-brand-muted text-slate-300 hover:border-slate-500 hover:text-white"
                }`}
              >
                <span>{cat.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl bg-brand-muted h-80 border border-slate-800" />
            ))}
          </div>
        )}

        {/* Paintings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPaintings.map((painting) => {
            // Support both direct public folder and API domain fallback
            const imageSrc = painting.image_url.startsWith("http")
              ? painting.image_url
              : `${API_URL}${painting.image_url}`;

            return (
              <div
                key={painting.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-brand-muted shadow-md hover:border-slate-500 hover:shadow-xl transition-all duration-200"
              >
                {/* Image Card Header with zoom button */}
                <div
                  className="relative aspect-square w-full overflow-hidden bg-slate-900 cursor-pointer"
                  onClick={() => setSelectedPainting(painting)}
                >
                  <img
                    src={imageSrc}
                    alt={painting.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/25 opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none" />
                  
                  {/* Category Pill (top-left) */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                    <span className="rounded-full bg-slate-900/85 backdrop-blur-sm border border-slate-600/70 px-2.5 py-1 text-[11px] font-semibold text-brand tracking-wide uppercase shadow">
                      {painting.category_label}
                    </span>
                  </div>

                  {/* Zoom hint icon (top-right) */}
                  <span className="absolute top-3 right-3 rounded-full bg-black/60 p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 transition shadow">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </span>
                </div>

                {/* Card Info Body */}
                <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-white text-base group-hover:text-brand transition">
                        {painting.title}
                      </h3>
                      <span className="shrink-0 rounded-lg bg-brand/15 border border-brand/30 px-2.5 py-1 text-xs font-bold text-brand">
                        From ₹{painting.starting_price}
                      </span>
                    </div>
                    {painting.artist_name && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Artist: <span className="text-slate-300 font-medium">{painting.artist_name}</span>
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">
                      {painting.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPainting(painting)}
                      className="text-xs text-slate-400 hover:text-white underline transition"
                    >
                      View Preview
                    </button>

                    {user?.role === "ADMIN" ? (
                      <Link
                        to="/admin"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500 hover:text-black transition"
                      >
                        <span>🛡️ Admin Portal</span>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOrderClick(painting)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
                      >
                        <span>Order in {painting.category}</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Customer Auth Choice Modal (when unauthenticated customer clicks Order) */}
      {authPromptPainting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-5">
            <button
              type="button"
              onClick={() => setAuthPromptPainting(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-600 bg-slate-900">
                <img
                  src={
                    authPromptPainting.image_url.startsWith("http")
                      ? authPromptPainting.image_url
                      : `${API_URL}${authPromptPainting.image_url}`
                  }
                  alt={authPromptPainting.title}
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-brand font-semibold">
                  {authPromptPainting.category_label}
                </p>
                <h3 className="text-base font-bold text-white">{authPromptPainting.title}</h3>
                <p className="text-xs text-slate-400">Starting from ₹{authPromptPainting.starting_price}</p>
              </div>
            </div>

            <div className="border-t border-slate-700/60 pt-4 space-y-2">
              <h4 className="text-sm font-semibold text-white">How would you like to continue?</h4>
              <p className="text-xs text-slate-300">
                To place your custom order in <strong>{authPromptPainting.category}</strong> style, please sign in if you already have an account, or register as a new customer.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigate(`/login?category=${encodeURIComponent(authPromptPainting.category)}`);
                }}
                className="w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-md shadow-brand/20 hover:opacity-90 transition text-center"
              >
                Existing Customer — Sign In
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate(`/register?category=${encodeURIComponent(authPromptPainting.category)}`);
                }}
                className="w-full rounded-xl border border-slate-600 bg-slate-800/80 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-700 transition text-center"
              >
                New Customer — Create Account
              </button>

              <button
                type="button"
                onClick={() => setAuthPromptPainting(null)}
                className="w-full py-1 text-center text-xs text-slate-400 hover:text-slate-200"
              >
                Cancel and keep browsing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal (click to inspect artwork up close) */}
      {selectedPainting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setSelectedPainting(null)}
        >
          <div
            className="relative max-w-2xl w-full overflow-hidden rounded-2xl border border-slate-700 bg-brand-muted shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPainting(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black/90"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="max-h-[70vh] overflow-hidden bg-black flex items-center justify-center">
              <img
                src={
                  selectedPainting.image_url.startsWith("http")
                    ? selectedPainting.image_url
                    : `${API_URL}${selectedPainting.image_url}`
                }
                alt={selectedPainting.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-brand uppercase tracking-wider">
                    {selectedPainting.category_label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{selectedPainting.title}</h3>
                {selectedPainting.artist_name && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    Artist: <span className="text-white font-medium">{selectedPainting.artist_name}</span>
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5 max-w-md">{selectedPainting.description}</p>
              </div>

              {user?.role === "ADMIN" ? (
                <Link
                  to="/admin"
                  onClick={() => setSelectedPainting(null)}
                  className="w-full sm:w-auto shrink-0 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black shadow-md shadow-amber-500/30 hover:opacity-90 transition text-center flex items-center justify-center gap-1.5"
                >
                  <span>🛡️</span> Manage in Admin Portal
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPainting;
                    setSelectedPainting(null);
                    handleOrderClick(p);
                  }}
                  className="w-full sm:w-auto shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand/30 hover:opacity-90 transition"
                >
                  Order in this Style
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
