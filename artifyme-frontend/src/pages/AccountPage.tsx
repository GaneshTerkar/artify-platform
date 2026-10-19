import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import PhotoUploader from "../components/PhotoUploader";
import { CollageThumbnail } from "../components/CollageThumbnail";
import { CollageArtworkModal } from "../components/CollageArtworkModal";
import { getCommissionSplit } from "../lib/commission";
import type { Order, VerifiedArtist } from "../types/order";
import { OrderCard } from "../components/OrderCard";
import { ConfirmModal } from "../components/ConfirmModal";
import { EarningsDashboardModal } from "../components/EarningsDashboardModal";
import { ReviewModal } from "../components/ReviewModal";

interface ArtistProfile {
  artist_prof_id?: string;
  artist_id: string;
  full_name: string;
  user_name?: string;
  email: string;
  bio?: string;
  experience_years?: number;
  verified: boolean;
}

interface ArtistReviewStatus {
  status: string;
  verified: boolean;
  rejected_reason?: string;
  rejected_at?: string;
}

interface ArtistPainting {
  painting_id: string;
  artist_id: string;
  title: string;
  description?: string;
  category: string;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export default function AccountPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const perspectiveParam = searchParams.get("perspective");

  const isAdmin = user?.role === "ADMIN";
  const isArtist = user?.role === "ARTIST" || (isAdmin && perspectiveParam === "artist");
  const isDelivery = user?.role === "DELIVERY_AGENT" || (isAdmin && perspectiveParam === "delivery");
  const isCustomer = user?.role === "CUSTOMER" || (isAdmin && (perspectiveParam === "customer" || (!isArtist && !isDelivery)));
  const commissionSplit = getCommissionSplit();

  // Navigation tabs for Artist Studio
  const [artistActiveTab, setArtistActiveTab] = useState<"COMMISSIONS" | "PORTFOLIO" | "PROFILE">("COMMISSIONS");

  // Lightbox & inspection modals
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string>("");
  const [failingOrder, setFailingOrder] = useState<Order | null>(null);
  const [selectedFailurePreset, setSelectedFailurePreset] = useState<string>("Customer unavailable / phone unreachable");
  const [customFailureNotes, setCustomFailureNotes] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showEarningsModal, setShowEarningsModal] = useState<boolean>(false);
  const [reviewingOrder, setReviewingOrder] = useState<Order | null>(null);

  // Custom confirmation dialog for delivery handover (replaces native window.confirm)
  const [confirmDeliveredDialog, setConfirmDeliveredDialog] = useState<{
    orderId: string;
    onConfirm: () => void;
    isPending: boolean;
  } | null>(null);

  // Custom confirmation dialog for Pay Now
  const [confirmPayDialog, setConfirmPayDialog] = useState<{
    orderId: string;
    onConfirm: () => void;
    isPending: boolean;
  } | null>(null);

  // Artist Profile form state
  const [profileBio, setProfileBio] = useState("");
  const [profileYears, setProfileYears] = useState(0);

  // Artist Add Painting modal state
  const [addingPainting, setAddingPainting] = useState(false);
  const [newPaintingTitle, setNewPaintingTitle] = useState("");
  const [newPaintingDesc, setNewPaintingDesc] = useState("");
  const [newPaintingCategory, setNewPaintingCategory] = useState("PENCIL");
  const [newPaintingImageUrl, setNewPaintingImageUrl] = useState("");

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  // 1. Fetch Orders (Customer orders, assigned artist commissions, or assigned deliveries)
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-orders", perspectiveParam],
    queryFn: () =>
      api<{ orders: Order[] }>(
        isAdmin ? `/api/v1/orders?perspective=${perspectiveParam || "customer"}` : "/api/v1/orders"
      ),
  });

  const orders = Array.isArray(data?.orders) ? data.orders : [];

  // Fetch Verified Artists (to resolve artist names on order cards)
  const { data: verifiedData } = useQuery({
    queryKey: ["verified_artists"],
    queryFn: () => api<{ verified_artists: VerifiedArtist[] }>("/api/v1/artists/verified"),
  });
  const verifiedArtists = verifiedData?.verified_artists ?? [];

  function getStatusBadge(status: string) {
    switch (status) {
      case "PUBLISHED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "DELIVERED":
        return "bg-teal-500/20 text-teal-300 border-teal-500/40";
      case "OUT_FOR_DELIVERY":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      case "IN_TRANSIT":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
      case "DELIVERY_FAILED":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "ASSIGNED_DELIVERY_AGENT":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      case "COMPLETED":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "IN_PROGRESS":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "ASSIGNED_ARTIST":
        return "bg-purple-500/20 text-purple-400 border-purple-500/40";
      case "CONFIRMED":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "CANCELLED":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      default:
        return "bg-slate-700/50 text-slate-300 border-slate-600";
    }
  }

  function getDisplayStatusLabel(status: string) {
    if (isArtist && status === "COMPLETED") {
      return "Collage Processing";
    }
    return status.replaceAll("_", " ");
  }

  // 2. Artist Specific Queries
  const { data: artistProfile, refetch: refetchProfile } = useQuery({
    queryKey: ["artist-profile"],
    queryFn: () => api<ArtistProfile>("/api/artist/profile/view"),
    enabled: isArtist,
  });

  const { data: artistReviewStatus } = useQuery({
    queryKey: ["artist-review-status"],
    queryFn: () => api<ArtistReviewStatus>("/api/artist/profile/review-status"),
    enabled: isArtist,
  });

  const { data: rawArtistPaintings, refetch: refetchPaintings } = useQuery({
    queryKey: ["artist-paintings"],
    queryFn: () => api<ArtistPainting[]>("/api/artist/paintings/"),
    enabled: isArtist,
  });

  const artistPaintings = Array.isArray(rawArtistPaintings) ? rawArtistPaintings : [];

  // Populate artist profile form when profile data loads
  useEffect(() => {
    if (artistProfile) {
      setProfileBio(artistProfile.bio || "");
      setProfileYears(artistProfile.experience_years || 0);
    }
  }, [artistProfile]);

  // 3. Status Transition Mutation (Start Drawing, Complete Artwork, Out for Delivery, Handover, Delivery Failed)
  const statusMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
      finalUrl,
      failureReason,
    }: {
      orderId: string;
      status: string;
      finalUrl?: string;
      failureReason?: string;
    }) =>
      api(`/api/v1/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          final_image_url: finalUrl,
          failure_reason: failureReason,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      queryClient.invalidateQueries({ queryKey: ["paintings"] });
      queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
      setCompletingOrder(null);
      setFinalImageUrl("");
      setFailingOrder(null);
      setCustomFailureNotes("");
      showMessage("Status updated successfully!");
    },
    onError: (err: Error) => {
      showMessage(err.message, "error");
    },
  });

  // 4. Customer Checkout Mutation (Pay Now)
  const checkoutMutation = useMutation({
    mutationFn: (orderId: string) =>
      api<{ checkout_url: string }>(`/api/v1/orders/${orderId}/checkout`, {
        method: "POST",
      }),
    onSuccess: (res) => {
      window.location.href = res.checkout_url;
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  // 5. Artist Profile Update Mutation
  const updateProfileMutation = useMutation({
    mutationFn: (body: { bio: string; experience_years: number }) =>
      api("/api/artist/profile", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      refetchProfile();
      showMessage("Artist profile updated successfully!");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  // 6. Artist Add Painting Mutation
  const addPaintingMutation = useMutation({
    mutationFn: (body: {
      title: string;
      description: string;
      category: string;
      image_url: string;
    }) =>
      api("/api/artist/paintings/add", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      refetchPaintings();
      queryClient.invalidateQueries({ queryKey: ["artist-review-status"] });
      setAddingPainting(false);
      setNewPaintingTitle("");
      setNewPaintingDesc("");
      setNewPaintingImageUrl("");
      showMessage("Artwork added to portfolio! Curation review status updated.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  function resolveImage(url?: string) {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  // --- STATS CALCULATIONS ---
  // Customer Stats
  const placedCount = orders.filter((o) => o.status === "PLACED").length;
  const inProgressCustomerCount = orders.filter((o) =>
    ["CONFIRMED", "ASSIGNED_ARTIST", "IN_PROGRESS", "COMPLETED", "ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"].includes(o.status)
  ).length;
  const deliveredCustomerCount = orders.filter((o) =>
    ["DELIVERED", "PUBLISHED"].includes(o.status)
  ).length;

  // Artist Stats
  const completedArtistOrders = orders.filter((o) =>
    ["COMPLETED", "ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "PUBLISHED"].includes(o.status)
  );
  const totalArtistEarnings = completedArtistOrders.reduce(
    (acc, o) => acc + Math.round(Number(o.total_price) * (commissionSplit.artistPercentage / 100)),
    0
  );

  // Delivery Stats
  const activeDeliveries = orders.filter((o) =>
    ["ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"].includes(o.status)
  );
  const deliveredHandovers = orders.filter((o) =>
    ["DELIVERED", "PUBLISHED"].includes(o.status)
  );
  const totalDeliveryEarnings = deliveredHandovers.reduce(
    (acc, o) => acc + Math.round(Number(o.total_price) * (commissionSplit.deliveryPercentage / 100)),
    0
  );

  if (isLoading) return <p className="text-slate-400 py-8 text-center">Loading orders…</p>;
  if (error) return <p className="text-rose-400 py-8 text-center">Could not load orders.</p>;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-sm font-medium border flex items-center justify-between transition-all ${
            message.type === "success"
              ? "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
              : "bg-rose-950/70 border-rose-500/60 text-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white">
              {isArtist
                ? "🎨 Artist Studio & Commissions"
                : isDelivery
                ? "🚚 Logistics & Doorstep Deliveries"
                : "Your Orders & Sketches"}
            </h1>
            {isArtist && (
              <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                🎨 Artist Studio
              </span>
            )}
            {isDelivery && (
              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                🚚 Delivery Agent
              </span>
            )}
            {isCustomer && (
              <span className="rounded-full bg-brand/20 border border-brand/40 px-2.5 py-0.5 text-xs font-semibold text-brand-light">
                👤 Art Collector
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isArtist
              ? "Manage commissioned portrait sketches, curate your public portfolio, and view your studio earnings."
              : isDelivery
              ? "Manage assigned portrait deliveries, dispatch packages from the studio, update live transit milestones, and record handovers."
              : "Track progress of your personalized handmade portrait commissions."}
          </p>
        </div>

        <div>
          {isCustomer && (
            <Link
              to="/order"
              className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition inline-flex items-center gap-1.5"
            >
              <span>+</span> New Custom Order
            </Link>
          )}
        </div>
      </div>

      {/* ROLE STATS BANNERS */}
      {/* 1. CUSTOMER SUMMARY CARDS */}
      {isCustomer && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-brand-muted/70 p-3.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Orders</span>
            <span className="text-2xl font-bold text-white mt-1 block">{orders.length}</span>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5">
            <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider block">Awaiting Payment</span>
            <span className="text-2xl font-bold text-amber-200 mt-1 block">{placedCount}</span>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
            <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider block">In Studio Crafting</span>
            <span className="text-2xl font-bold text-cyan-200 mt-1 block">{inProgressCustomerCount}</span>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
            <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">Delivered & Ready</span>
            <span className="text-2xl font-bold text-emerald-200 mt-1 block">{deliveredCustomerCount}</span>
          </div>
        </div>
      )}

      {/* 2. ARTIST STUDIO DASHBOARD & STATS BANNER */}
      {isArtist && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider block">Assigned Commissions</span>
              <span className="text-2xl font-bold text-white mt-1 block">{orders.length}</span>
            </div>
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider block">In Progress</span>
              <span className="text-2xl font-bold text-blue-200 mt-1 block">
                {orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED_ARTIST").length}
              </span>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">Artworks Completed</span>
              <span className="text-2xl font-bold text-emerald-200 mt-1 block">{completedArtistOrders.length}</span>
            </div>
            <div className="rounded-xl border border-brand/40 bg-brand/10 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-brand-light uppercase tracking-wider block">
                    Studio Earnings ({commissionSplit.artistPercentage}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEarningsModal(true)}
                    className="text-[10px] bg-brand/30 hover:bg-brand/50 text-brand-light px-2 py-0.5 rounded font-medium border border-brand/40 transition flex items-center gap-1 shadow-sm"
                    title="Open Detailed Earnings & Analytics Dashboard"
                  >
                    📊 Analytics
                  </button>
                </div>
                <span className="text-2xl font-bold text-white mt-1 block">₹{totalArtistEarnings.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Artist Review Status Banner */}
          {artistReviewStatus && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-lg">
                  {artistReviewStatus.verified
                    ? "🛡️"
                    : artistReviewStatus.status === "UNDER_REVIEW"
                    ? "⏳"
                    : artistReviewStatus.status === "REJECTED"
                    ? "⚠️"
                    : "📝"}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-white">Curation & Verification Status:</span>
                    {artistReviewStatus.verified ? (
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        ✓ Verified Studio Artist (Active)
                      </span>
                    ) : artistReviewStatus.status === "UNDER_REVIEW" ? (
                      <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                        ⏳ Under Curation Review
                      </span>
                    ) : artistReviewStatus.status === "REJECTED" ? (
                      <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
                        ⚠️ Application Feedback Received
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        Pending Portfolio Upload
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {artistReviewStatus.verified
                      ? "Your artist profile is approved and actively receiving portrait commissions."
                      : artistReviewStatus.status === "UNDER_REVIEW"
                      ? "Your portfolio is currently being evaluated by our curation administrators. Once approved, commissions will be assigned."
                      : artistReviewStatus.status === "REJECTED"
                      ? `Feedback: ${artistReviewStatus.rejected_reason || "Please update portfolio to meet fine-art criteria."}`
                      : "Upload at least one sample painting to your portfolio below to automatically submit your profile for admin verification."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Artist Studio Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
            <button
              onClick={() => setArtistActiveTab("COMMISSIONS")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                artistActiveTab === "COMMISSIONS"
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🎨 Assigned Commissions ({orders.length})
            </button>
            <button
              onClick={() => setArtistActiveTab("PORTFOLIO")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                artistActiveTab === "PORTFOLIO"
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              🖼️ Portfolio Showcase ({artistPaintings.length})
            </button>
            <button
              onClick={() => setArtistActiveTab("PROFILE")}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition ${
                artistActiveTab === "PROFILE"
                  ? "border-purple-500 text-purple-300"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              👤 Studio Bio & Profile
            </button>
          </div>
        </div>
      )}

      {/* 3. DELIVERY AGENT LOGISTICS DASHBOARD & STATS BANNER */}
      {isDelivery && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider block">Assigned Parcels</span>
              <span className="text-2xl font-bold text-white mt-1 block">{orders.length}</span>
            </div>
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-sky-300 uppercase tracking-wider block">Active Dispatches</span>
              <span className="text-2xl font-bold text-sky-200 mt-1 block">{activeDeliveries.length}</span>
            </div>
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider block">Doorstep Handovers</span>
              <span className="text-2xl font-bold text-emerald-200 mt-1 block">{deliveredHandovers.length}</span>
            </div>
            <div className="rounded-xl border border-brand/40 bg-brand/10 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-brand-light uppercase tracking-wider block">
                    Delivery Fees ({commissionSplit.deliveryPercentage}%)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowEarningsModal(true)}
                    className="text-[10px] bg-sky-500/30 hover:bg-sky-500/50 text-sky-200 px-2 py-0.5 rounded font-medium border border-sky-500/40 transition flex items-center gap-1 shadow-sm"
                    title="Open Detailed Earnings & Logistics Analytics Dashboard"
                  >
                    📊 Analytics
                  </button>
                </div>
                <span className="text-2xl font-bold text-white mt-1 block">₹{totalDeliveryEarnings.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-xs text-cyan-200 flex items-center justify-between">
            <span>
              🚚 <strong>Logistics Protocol:</strong> Verify parcel packaging prior to dispatch. Maintain customer updates during transit and record any delivery exceptions immediately.
            </span>
            <span className="font-semibold text-cyan-300 hidden sm:inline">
              Max 3 Doorstep Attempts Guaranteed
            </span>
          </div>
        </div>
      )}

      {/* TAB CONTENT: ARTIST PORTFOLIO SHOWCASE */}
      {isArtist && artistActiveTab === "PORTFOLIO" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-brand-muted/40 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-white">Your Public Portfolio Showcase</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Artwork uploaded here is reviewed by ArtifyMe curators and showcased to prospective clients.
              </p>
            </div>
            <button
              onClick={() => setAddingPainting(true)}
              className="rounded-xl bg-purple-600 hover:bg-purple-500 px-4 py-2 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm"
            >
              <span>+</span> Upload Sample Painting
            </button>
          </div>

          {artistPaintings.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-brand-muted p-12 text-center space-y-3">
              <p className="text-base font-semibold text-slate-300">No portfolio paintings added yet.</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Add sample pencil sketches, charcoal portraits, watercolors, or oil paintings to showcase your craft and get verified.
              </p>
              <button
                onClick={() => setAddingPainting(true)}
                className="rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-500 transition"
              >
                + Add Your First Painting
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {artistPaintings.map((p) => (
                <div
                  key={p.painting_id}
                  className="rounded-2xl border border-slate-800 bg-brand-muted overflow-hidden shadow-sm flex flex-col group hover:border-slate-700 transition"
                >
                  <div
                    onClick={() => setSelectedPhoto(resolveImage(p.image_url))}
                    className="aspect-[4/5] w-full overflow-hidden bg-slate-950 cursor-pointer relative flex items-center justify-center"
                  >
                    <img
                      src={resolveImage(p.image_url)}
                      alt={p.title}
                      className="h-full w-full object-contain group-hover:scale-105 transition duration-300"
                    />
                    <span className="absolute top-2.5 right-2.5 rounded-full bg-black/70 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30">
                      {p.category}
                    </span>
                  </div>
                  <div className="p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white line-clamp-1">{p.title}</h3>
                      {p.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{p.description}</p>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                      <span>Added {new Date(p.created_at).toLocaleDateString()}</span>
                      <span className="text-purple-400 font-medium">Fine Art</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: ARTIST PROFILE & BIO */}
      {isArtist && artistActiveTab === "PROFILE" && (
        <div className="space-y-4 animate-in fade-in max-w-2xl">
          <div className="rounded-2xl border border-slate-800 bg-brand-muted p-6 space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Studio Profile & Credentials</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Keep your artist biography, years of portrait experience, and studio information updated.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-300 border-b border-slate-800 pb-4">
              <div>
                <span className="text-slate-500 block mb-0.5">Full Name</span>
                <span className="font-semibold text-white">{user?.full_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Email Address</span>
                <span className="font-semibold text-white">{user?.email}</span>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateProfileMutation.mutate({
                  bio: profileBio,
                  experience_years: Number(profileYears) || 0,
                });
              }}
              className="space-y-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Years of Fine Art Experience</label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={profileYears}
                  onChange={(e) => setProfileYears(Number(e.target.value))}
                  className="w-full sm:w-48 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 block">Artist Biography & Specialization</label>
                <textarea
                  rows={4}
                  placeholder="Describe your art training, preferred mediums (Pencil, Charcoal, Watercolor, Oil), and artistic approach..."
                  value={profileBio}
                  onChange={(e) => setProfileBio(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="rounded-xl bg-purple-600 hover:bg-purple-500 px-5 py-2 text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
                >
                  {updateProfileMutation.isPending ? "Saving..." : "Save Artist Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB CONTENT: COMMISSIONS / ORDERS LIST (Default for Customer, Delivery, and Artist Commissions Tab) */}
      {(!isArtist || artistActiveTab === "COMMISSIONS") && (
        <>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-brand-muted p-12 text-center space-y-3">
              <p className="text-base font-semibold text-slate-300">
                {isArtist
                  ? "No commissions assigned yet."
                  : isDelivery
                  ? "No deliveries assigned to your logistics profile yet."
                  : "You have not placed any orders yet."}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {isArtist
                  ? "When administrators assign customer portrait orders to your verified profile, they will appear here."
                  : isDelivery
                  ? "When administrators assign completed portraits to you for doorstep delivery, they will appear here."
                  : "Browse our gallery to discover styles and order your first custom handmade portrait sketch."}
              </p>
              {isCustomer && (
                <Link
                  to="/"
                  className="inline-block mt-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition"
                >
                  Browse Gallery
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => {
                const role = isArtist ? "ARTIST" : isDelivery ? "DELIVERY_AGENT" : "CUSTOMER";
                return (
                  <OrderCard
                    key={o.order_id}
                    order={o}
                    role={role}
                    verifiedArtists={verifiedArtists}
                    currentUserName={user?.full_name}
                    commissionSplit={commissionSplit}
                    onInspectCollage={(order) => setInspectingOrder(order)}
                    onViewPhoto={(url) => setSelectedPhoto(url)}
                    onArtistAccept={(order) => statusMutation.mutate({ orderId: order.order_id, status: "IN_PROGRESS" })}
                    onArtistDecline={(order) => {
                      if (window.confirm("Are you sure you cannot accept this order? The order will be reverted to Confirmed for admin reassignment.")) {
                        statusMutation.mutate({ orderId: order.order_id, status: "CONFIRMED" });
                      }
                    }}
                    onArtistComplete={(order) => {
                      setCompletingOrder(order);
                      setFinalImageUrl(order.final_image_url || "");
                    }}
                    onDeliveryPickUp={(order) => statusMutation.mutate({ orderId: order.order_id, status: "IN_TRANSIT" })}
                    onDeliveryDirectOut={(order) => statusMutation.mutate({ orderId: order.order_id, status: "OUT_FOR_DELIVERY" })}
                    onDeliveryDecline={(order) => {
                      if (window.confirm("Cannot deliver this order? It will revert back to assign a delivery agent.")) {
                        statusMutation.mutate({ orderId: order.order_id, status: "COMPLETED" });
                      }
                    }}
                    onDeliveryOutToday={(order) => statusMutation.mutate({ orderId: order.order_id, status: "OUT_FOR_DELIVERY" })}
                    onDeliveryDelivered={(order) => {
                      setConfirmDeliveredDialog({
                        orderId: order.order_id,
                        onConfirm: () => {
                          statusMutation.mutate({ orderId: order.order_id, status: "DELIVERED" });
                        },
                        isPending: statusMutation.isPending,
                      });
                    }}
                    onDeliveryFailed={(order) => {
                      setFailingOrder(order);
                      setSelectedFailurePreset("Customer unavailable / phone unreachable");
                      setCustomFailureNotes("");
                    }}
                    onDeliveryReattempt={(order) => statusMutation.mutate({ orderId: order.order_id, status: "OUT_FOR_DELIVERY" })}
                    onCustomerPay={(orderId) => {
                      setConfirmPayDialog({
                        orderId,
                        onConfirm: () => {
                          checkoutMutation.mutate(orderId);
                        },
                        isPending: checkoutMutation.isPending,
                      });
                    }}
                    onCustomerCancel={(orderId) => {
                      if (window.confirm("Are you sure you want to cancel this order?")) {
                        statusMutation.mutate({ orderId, status: "CANCELLED" });
                      }
                    }}
                    onCustomerLeaveReview={(order) => setReviewingOrder(order)}
                    isPaying={checkoutMutation.isPending}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {/* MODAL: DELIVERY HANDOVER CONFIRMATION */}
      {confirmDeliveredDialog && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmDeliveredDialog(null)}
          title="Confirm Delivery Handover"
          message="Confirm that parcel has been safely handed over to the customer?"
          confirmLabel="Mark Delivered"
          onConfirm={() => {
            if (confirmDeliveredDialog) {
              statusMutation.mutate({ orderId: confirmDeliveredDialog.orderId, status: "DELIVERED" });
            }
          }}
          isPending={confirmDeliveredDialog?.isPending ?? false}
        />
      )}

      {/* MODAL: PAY NOW CONFIRMATION */}
      {confirmPayDialog && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmPayDialog(null)}
          title="Confirm Payment"
          message="Are you sure you want to proceed to payment for this portrait order?"
          confirmLabel="Pay Now"
          onConfirm={() => {
            if (confirmPayDialog) {
              checkoutMutation.mutate(confirmPayDialog.orderId);
            }
          }}
          isPending={confirmPayDialog?.isPending ?? false}
        />
      )}

      {/* MODAL: ADD PORTFOLIO PAINTING FOR ARTIST */}
      {addingPainting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🖼️</span> Upload Portfolio Painting
              </h3>
              <button
                onClick={() => setAddingPainting(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload your handmade artwork samples to showcase in your artist portfolio. Adding paintings automatically triggers curation review by ArtifyMe administrators.
            </p>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 space-y-1">
                <span>Artwork Title</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vintage Charcoal Portrait"
                  value={newPaintingTitle}
                  onChange={(e) => setNewPaintingTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </label>

              <label className="block text-xs font-semibold text-slate-300 space-y-1">
                <span>Artistic Medium / Category</span>
                <select
                  value={newPaintingCategory}
                  onChange={(e) => setNewPaintingCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                >
                  <option value="PENCIL">Pencil Sketch</option>
                  <option value="CHARCOAL">Charcoal Drawing</option>
                  <option value="WATERCOLOR">Watercolor Painting</option>
                  <option value="OIL">Oil Painting</option>
                </select>
              </label>

              <label className="block text-xs font-semibold text-slate-300 space-y-1">
                <span>Artwork Description</span>
                <textarea
                  rows={2}
                  placeholder="Techniques, paper/canvas used, inspiration..."
                  value={newPaintingDesc}
                  onChange={(e) => setNewPaintingDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </label>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">Artwork Photo</label>
                <PhotoUploader value={newPaintingImageUrl} onChange={setNewPaintingImageUrl} />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAddingPainting(false)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newPaintingTitle || !newPaintingImageUrl || addPaintingMutation.isPending}
                onClick={() =>
                  addPaintingMutation.mutate({
                    title: newPaintingTitle,
                    description: newPaintingDesc,
                    category: newPaintingCategory,
                    image_url: newPaintingImageUrl,
                  })
                }
                className="rounded-lg bg-purple-600 hover:bg-purple-500 px-5 py-2 text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
              >
                {addPaintingMutation.isPending ? "Uploading..." : "✓ Add to Portfolio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE & UPLOAD SKETCH FOR ARTIST */}
      {completingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-5 my-auto max-h-[92vh] overflow-y-auto">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🎨</span> Complete & Upload Finished Sketch
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload your hand-drawn sketch photo for order{" "}
                <strong className="text-white font-mono">#{completingOrder.order_id.slice(0, 8)}</strong>. Once
                submitted, a composite comparison collage is automatically created!
              </p>
            </div>

            {/* Photo Uploader Component with Drag & Drop */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 block">Finished Portrait Artwork</label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const cat = completingOrder.painting_category?.toUpperCase() || "OIL";
                      setFinalImageUrl(`/uploads/admin_test_fixtures/suite_1_solo_portrait/${cat}.jpg`);
                    }}
                    className="text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded font-semibold transition flex items-center gap-1 shadow-sm"
                    title="Load matching converted artwork fixture for this category"
                  >
                    <span>⚡</span> Load Converted {completingOrder.painting_category} Fixture
                  </button>
                )}
              </div>
              <PhotoUploader value={finalImageUrl} onChange={setFinalImageUrl} />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setCompletingOrder(null);
                  setFinalImageUrl("");
                }}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!finalImageUrl || statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    orderId: completingOrder.order_id,
                    status: "COMPLETED",
                    finalUrl: finalImageUrl,
                  })
                }
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 transition shadow-sm"
              >
                {statusMutation.isPending ? "Publishing..." : "✓ Submit & Complete Commission"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLAGE ARTWORK MODAL */}
      {inspectingOrder && inspectingOrder.final_image_url && (
        <CollageArtworkModal
          isOpen={Boolean(inspectingOrder)}
          onClose={() => setInspectingOrder(null)}
          orderId={inspectingOrder.order_id}
          finalImageUrl={resolveImage(inspectingOrder.original_final_image_url || inspectingOrder.final_image_url)}
          refImageUrl={inspectingOrder.reference_image_url ? resolveImage(inspectingOrder.reference_image_url) : undefined}
          collageImageUrl={inspectingOrder.collage_image_url ? resolveImage(inspectingOrder.collage_image_url) : undefined}
          category={inspectingOrder.painting_category}
          size={inspectingOrder.size}
        />
      )}

      {/* LIGHTBOX PREVIEW MODAL */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-3xl w-full overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 p-2">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/60 p-2 text-white hover:bg-black"
            >
              ✕
            </button>
            <img src={selectedPhoto} alt="Full view" className="max-h-[80vh] w-full object-contain rounded-xl" />
          </div>
        </div>
      )}

      {/* MODAL: LOG DELIVERY ATTEMPT FAILED */}
      {failingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>⚠️</span> Log Unsuccessful Delivery Attempt
              </h3>
              <button
                onClick={() => setFailingOrder(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Parcel <strong className="text-white font-mono">#{failingOrder.order_id.slice(0, 8)}</strong> • Attempt{" "}
              <strong className="text-amber-300">{(failingOrder.delivery_attempts || 0) + 1} of 3</strong>
            </p>

            <div className="space-y-2.5">
              <label className="block text-xs text-slate-300 font-medium">
                Reason for Unsuccessful Attempt:
              </label>
              {[
                "Customer unavailable / phone unreachable",
                "Premises locked / no one at home",
                "Incorrect / incomplete address or landmark missing",
                "Customer requested reschedule for another day",
                "Refused to accept package",
                "Other (specify below)",
              ].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                    selectedFailurePreset === reason
                      ? "bg-slate-800 border-rose-500/60 text-white font-medium"
                      : "bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="failureReason"
                    checked={selectedFailurePreset === reason}
                    onChange={() => setSelectedFailurePreset(reason)}
                    className="accent-rose-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}

              {selectedFailurePreset.startsWith("Other") && (
                <textarea
                  rows={2}
                  placeholder="Enter detailed reason / customer notes..."
                  value={customFailureNotes}
                  onChange={(e) => setCustomFailureNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white text-xs placeholder:text-slate-500 mt-2"
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setFailingOrder(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={statusMutation.isPending}
                onClick={() => {
                  const finalReason = selectedFailurePreset.startsWith("Other")
                    ? (customFailureNotes.trim() || "Unspecified courier attempt failure")
                    : selectedFailurePreset;
                  statusMutation.mutate({
                    orderId: failingOrder.order_id,
                    status: "DELIVERY_FAILED",
                    failureReason: finalReason,
                  });
                }}
                className="rounded-lg bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50 shadow-sm"
              >
                {statusMutation.isPending ? "Logging..." : "Confirm Failed Attempt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EARNINGS & PERFORMANCE ANALYTICS DASHBOARD MODAL */}
      {showEarningsModal && user && (
        <EarningsDashboardModal
          isOpen={showEarningsModal}
          onClose={() => setShowEarningsModal(false)}
          role={isArtist ? "ARTIST" : "DELIVERY_AGENT"}
          user={{
            user_id: user.user_id,
            full_name: user.full_name,
            email: user.email,
            phone_number: user.phone_number,
            address: user.address,
            bio: isArtist ? artistProfile?.bio : undefined,
          }}
          orders={orders}
          commissionPercentage={
            isArtist ? commissionSplit.artistPercentage : commissionSplit.deliveryPercentage
          }
          platformMarginPercentage={
            100 - (isArtist ? commissionSplit.artistPercentage : commissionSplit.deliveryPercentage)
          }
          onViewPhoto={(url) => setSelectedPhoto(url)}
        />
      )}

      {/* VERIFIED CUSTOMER REVIEW MODAL */}
      {reviewingOrder && (
        <ReviewModal
          isOpen={Boolean(reviewingOrder)}
          order={reviewingOrder}
          onClose={() => setReviewingOrder(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["my-orders"] });
          }}
        />
      )}
    </div>
  );
}
