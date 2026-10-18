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
      {/* Impressive Artistic Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-[#0e1629] to-[#1a0f2e] p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl">
        {/* Ambient Decorative Lighting */}
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-20 -translate-y-1/2 w-96 h-96 rounded-full bg-gradient-to-br from-cyan-500/15 via-purple-600/15 to-pink-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 left-1/3 w-72 h-72 rounded-full bg-gradient-to-br from-blue-600/10 via-teal-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Subtle Canvas Grain / Grid Texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Left Column: Inspiring Artistic Copy & Actions */}
          <div className="lg:col-span-7 space-y-5">
            {/* Artistic Studio Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 px-3.5 py-1 text-xs font-semibold text-amber-300 shadow-inner backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              <span className="tracking-wide uppercase text-[11px] font-bold">Handmade Fine Art Studio</span>
              <span className="text-white/40">•</span>
              <span className="text-xs text-rose-300">100% Real Artists</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.14]">
              Original Hand-Drawn & Painted{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
                Portrait Sketches
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              Turn your treasured photographs into authentic, handcrafted fine art. Created by verified master artists on 300 GSM archival cotton — from expressive pencil sketches to vibrant watercolors and rich oils.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {user?.role !== "ADMIN" ? (
                <Link
                  to="/order"
                  className="rounded-xl bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-400 text-slate-950 font-extrabold px-6 py-3.5 text-sm shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                >
                  <span>✨</span>
                  <span>Order Custom Sketch</span>
                </Link>
              ) : (
                <>
                  <Link
                    to="/admin"
                    className="rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold px-5 py-3.5 text-sm shadow-lg shadow-purple-500/25 hover:opacity-90 transition flex items-center gap-2"
                  >
                    <span>👑</span>
                    <span>Admin Studio Operations</span>
                  </Link>
                  <Link
                    to="/order"
                    className="rounded-xl border border-brand/50 bg-brand/10 hover:bg-brand/20 text-brand font-semibold px-4 py-3.5 text-sm transition flex items-center gap-2"
                  >
                    <span>🎨</span>
                    <span>Preview Order Flow</span>
                  </Link>
                </>
              )}

              <a
                href="#gallery"
                className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 px-5 py-3.5 text-sm font-semibold text-slate-200 hover:text-white transition backdrop-blur-md flex items-center gap-2 shadow-sm"
              >
                <span>Browse Gallery Styles</span>
                <span>↓</span>
              </a>
            </div>

            {/* Trust Badges */}
            <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span className="text-slate-300">100% Hand-Crafted (No AI Filters)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-cyan-400 font-bold">✓</span>
                <span className="text-slate-300">5 Historic Art Styles</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 font-bold">✓</span>
                <span className="text-slate-300">Safe Doorstep Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Artistic Studio Showcase */}
          <div className="lg:col-span-5 relative flex justify-center">
            {/* Outer Decorative Glow Ring */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-pink-500/20 via-cyan-500/10 to-amber-500/20 blur-xl -rotate-2 scale-105 pointer-events-none" />

            {/* Floating Top Badge */}
            <div className="absolute -top-3 -right-2 sm:-right-4 z-20 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-amber-300 shadow-xl backdrop-blur-md rotate-2">
              <span>⭐</span>
              <span>4.9/5 Master Rating</span>
            </div>

            {/* Floating Bottom Badge */}
            <div className="absolute -bottom-3 -left-2 sm:-left-4 z-20 flex items-center gap-2 rounded-xl border border-cyan-400/40 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-cyan-300 shadow-xl backdrop-blur-md -rotate-2">
              <span>🖌️</span>
              <span>100% Archival Canvas</span>
            </div>

            {/* Main Studio Showcase Card */}
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-xl space-y-3.5">
              {/* Studio Canvas Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-bold text-white tracking-wide">ArtifyMe Fine Art Studio</span>
                </div>
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded">
                  Live Gallery
                </span>
              </div>

              {/* Artwork Preview Area */}
              {paintings.length > 0 ? (
                /* Display Featured Live Painting from Backend */
                <div
                  className="group relative aspect-[4/5] rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer shadow-inner"
                  onClick={() => setSelectedPainting(paintings[0])}
                >
                  <img
                    src={paintings[0].image_url.startsWith("http") ? paintings[0].image_url : `${API_URL}${paintings[0].image_url}`}
                    alt={paintings[0].title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-brand uppercase tracking-wider block">
                        {paintings[0].category_label}
                      </span>
                      <h4 className="text-sm font-bold text-white drop-shadow">{paintings[0].title}</h4>
                      {paintings[0].artist_name && (
                        <p className="text-[11px] text-slate-300">By {paintings[0].artist_name}</p>
                      )}
                    </div>
                    <span className="rounded-lg bg-black/70 border border-white/20 px-2 py-1 text-xs font-bold text-white shadow">
                      From ₹{paintings[0].starting_price}
                    </span>
                  </div>
                </div>
              ) : (
                /* Bespoke Artistic Easel Composition when no paintings are in catalog */
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-gradient-to-b from-slate-950 via-[#101728] to-slate-950 border border-slate-800/80 p-4 flex flex-col justify-between shadow-inner">
                  {/* Subtle Background Sketch Grid & Splatter Effect */}
                  <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#ec4899_1px,transparent_1px)] [background-size:16px_16px]" />
                  
                  {/* Top: Fine Art Medium Swatches Palette */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-[11px] font-mono text-amber-300/90 font-semibold tracking-wider uppercase">
                      ✦ Hand-Drawn Techniques
                    </span>
                    <span className="text-[10px] text-slate-400">Custom Commission</span>
                  </div>

                  {/* Center: Artistic Illustration Display */}
                  <div className="relative z-10 text-center py-2 space-y-3">
                    <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-500/20 via-pink-500/20 to-amber-500/20 border border-white/10 flex items-center justify-center text-4xl shadow-xl shadow-purple-500/10">
                      🎨
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white">Bespoke Portrait Art</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Drawn on 300 GSM Cold-Pressed Archival Paper
                      </p>
                    </div>
                  </div>

                  {/* Bottom: 5 Medium Swatches Palette */}
                  <div className="relative z-10 space-y-2 bg-slate-950/80 rounded-xl p-2.5 border border-slate-800">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Available Mediums</span>
                      <span className="text-emerald-400 font-semibold">Artist Certified</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-[10px]">
                      <div className="rounded-lg bg-slate-800/90 border border-slate-700/80 py-1.5 text-slate-200 font-medium">
                        ✏️ Pencil
                      </div>
                      <div className="rounded-lg bg-slate-800/90 border border-slate-700/80 py-1.5 text-slate-200 font-medium">
                        🖤 Charcoal
                      </div>
                      <div className="rounded-lg bg-slate-800/90 border border-slate-700/80 py-1.5 text-slate-200 font-medium">
                        🌊 Water
                      </div>
                      <div className="rounded-lg bg-slate-800/90 border border-slate-700/80 py-1.5 text-slate-200 font-medium">
                        🎨 Acrylic
                      </div>
                      <div className="rounded-lg bg-slate-800/90 border border-slate-700/80 py-1.5 text-slate-200 font-medium">
                        🖼️ Oil
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Filter Swatch Links below canvas */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-medium text-slate-300">Tap to browse style:</span>
                <div className="flex items-center gap-1.5">
                  {CATEGORIES.filter((c) => c.id !== "ALL").slice(0, 3).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(c.id);
                        document.getElementById("gallery")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="rounded-md bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white transition border border-slate-700"
                    >
                      {c.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
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

        {/* Empty State */}
        {!isLoading && filteredPaintings.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-12 text-center space-y-3">
            <div className="text-4xl">🎨</div>
            <h3 className="text-lg font-bold text-white">No Artworks in Gallery Yet</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Our verified artists have not published any gallery paintings yet. Custom commissioned orders completed by artists will appear here automatically.
            </p>
            {user?.role !== "ADMIN" && (
              <Link
                to="/order"
                className="inline-block rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
              >
                Order a Custom Portrait →
              </Link>
            )}
          </div>
        )}

        {/* Paintings Grid */}
        {!isLoading && filteredPaintings.length > 0 && (
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
                {/* Image Card Header with zoom button (aspect-[4/5] with object-cover fills edge-to-edge seamlessly without gaps) */}
                <div
                  className="relative aspect-[4/5] w-full overflow-hidden bg-slate-900 cursor-pointer"
                  onClick={() => setSelectedPainting(painting)}
                >
                  <img
                    src={imageSrc}
                    alt={painting.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/25 opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none" />
                  
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
                      <div>
                        <span className="text-[11px] font-semibold text-brand uppercase tracking-wider block mb-0.5">
                          {painting.category_label}
                        </span>
                        <h3 className="font-semibold text-white text-base group-hover:text-brand transition">
                          {painting.title}
                        </h3>
                      </div>
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

                    {user?.role !== "ADMIN" && (
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
      )}
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

              {user?.role !== "ADMIN" && (
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
