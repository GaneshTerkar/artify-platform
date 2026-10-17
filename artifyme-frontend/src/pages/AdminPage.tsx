import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Order, VerifiedArtist, ArtistReviewItem, PlatformUser } from "../types/order";
import { CollageThumbnail } from "../components/CollageThumbnail";
import { CollageArtworkModal } from "../components/CollageArtworkModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: "orders" | "users" = tabParam === "users" ? "users" : "orders";

  const handleTabChange = (tab: "orders" | "users") => {
    setSearchParams({ tab });
  };
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [artistFilter, setArtistFilter] = useState<string>("ALL");
  const [orderSearchQuery, setOrderSearchQuery] = useState<string>("");

  const showArtistFilter = statusFilter !== "PLACED" && statusFilter !== "CANCELLED";

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    if (status === "PLACED" || status === "CANCELLED") {
      setArtistFilter("ALL");
    }
  };
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | "CUSTOMER" | "ARTIST" | "ADMIN">("ALL");
  const [artistStatusFilter, setArtistStatusFilter] = useState<"ALL" | "VERIFIED" | "PENDING_REVIEW">("ALL");
  const [userSearchQuery, setUserSearchQuery] = useState<string>("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);

  const STATUS_PRIORITY: Record<string, number> = {
    PLACED: 1,
    CONFIRMED: 2,
    ASSIGNED_ARTIST: 3,
    IN_PROGRESS: 4,
    COMPLETED: 5,
    PUBLISHED: 6,
    CANCELLED: 7,
  };

  function getOrderLifecycleStatus(order: Order): string {
    if (order.status === "COMPLETED" && order.is_published_to_gallery) {
      return "PUBLISHED";
    }
    return order.status;
  }

  // Modal states
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");

  const [rejectingArtist, setRejectingArtist] = useState<ArtistReviewItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  }

  // 1. Fetch All Platform Orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin_orders"],
    queryFn: () => api<{ orders: Order[] }>("/api/v1/admin/orders"),
  });
  const allOrders = ordersData?.orders ?? [];

  // 2. Fetch Artists in Review Queue
  const { data: reviewQueue, isLoading: queueLoading } = useQuery({
    queryKey: ["admin_review_queue"],
    queryFn: () => api<ArtistReviewItem[]>("/api/admin/artists/review-queue"),
  });
  const pendingArtists = reviewQueue ?? [];

  // 3. Fetch Verified Artists
  const { data: verifiedData } = useQuery({
    queryKey: ["verified_artists"],
    queryFn: () => api<{ verified_artists: VerifiedArtist[] }>("/api/v1/artists/verified"),
  });
  const verifiedArtists = verifiedData?.verified_artists ?? [];

  // 4. Fetch All Platform Users
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["admin_users"],
    queryFn: () => api<{ users: PlatformUser[] }>("/api/v1/admin/users"),
  });
  const allUsers = usersData?.users ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allOrders.length };
    for (const o of allOrders) {
      if (o.status) {
        counts[o.status] = (counts[o.status] || 0) + 1;
      }
    }
    return counts;
  }, [allOrders]);

  const needsInspectionCount = useMemo(() => {
    return allOrders.filter((o) => o.status === "COMPLETED" && !o.is_published_to_gallery).length;
  }, [allOrders]);

  const inspectedCount = useMemo(() => {
    return allOrders.filter((o) => o.status === "COMPLETED" && o.is_published_to_gallery).length;
  }, [allOrders]);

  const filteredOrders = useMemo(() => {
    return allOrders.filter((o) => {
      // 1. Status Filter
      if (statusFilter === "PUBLISHED") {
        if (o.status !== "COMPLETED" || !o.is_published_to_gallery) return false;
      } else if (statusFilter === "COMPLETED") {
        if (o.status !== "COMPLETED" || o.is_published_to_gallery) return false;
      } else if (statusFilter !== "ALL" && o.status !== statusFilter) {
        return false;
      }
      // 2. Artist Filter (only applies when status is not PLACED or CANCELLED)
      if (showArtistFilter) {
        if (artistFilter === "ASSIGNED" && !o.artist_id) return false;
        if (artistFilter === "UNASSIGNED" && Boolean(o.artist_id)) return false;
        if (
          artistFilter !== "ALL" &&
          artistFilter !== "ASSIGNED" &&
          artistFilter !== "UNASSIGNED" &&
          o.artist_id !== artistFilter
        ) {
          return false;
        }
      }
      // 3. Search Query
      if (orderSearchQuery.trim()) {
        const rawQ = orderSearchQuery.trim().toLowerCase();
        const cleanQ = rawQ.replace(/^#/, "");
        const customer = allUsers.find((u) => u.user_id === o.user_id);
        const artist = verifiedArtists.find((a) => a.artist_id === o.artist_id);
        const artistName = artist?.full_name?.toLowerCase();
        const displayStatus = getOrderLifecycleStatus(o).toLowerCase();

        const matchId = Boolean(o.order_id?.toLowerCase()?.includes(cleanQ));
        const matchCategory = Boolean(o.painting_category?.toLowerCase()?.includes(rawQ));
        const matchAddress = Boolean(o.delivery_address?.toLowerCase()?.includes(rawQ));
        const matchNotes = Boolean(o.customer_notes?.toLowerCase()?.includes(rawQ));
        const matchArtist = Boolean(artistName?.includes(rawQ));
        const matchCustomer = Boolean(
          customer?.full_name?.toLowerCase()?.includes(rawQ) ||
          customer?.email?.toLowerCase()?.includes(rawQ) ||
          customer?.user_name?.toLowerCase()?.includes(rawQ)
        );
        const matchStatus = Boolean(
          displayStatus.includes(rawQ) ||
          (rawQ.includes("inspect") && displayStatus === "completed")
        );
        const matchSize = Boolean(o.size?.toLowerCase()?.includes(rawQ));
        const matchPersons = Boolean(o.persons_included?.toLowerCase()?.includes(rawQ));

        if (
          !matchId &&
          !matchCategory &&
          !matchAddress &&
          !matchNotes &&
          !matchArtist &&
          !matchCustomer &&
          !matchStatus &&
          !matchSize &&
          !matchPersons
        ) {
          return false;
        }
      }
      return true;
    });
  }, [allOrders, statusFilter, artistFilter, orderSearchQuery, verifiedArtists, allUsers, showArtistFilter]);

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      const statusA = getOrderLifecycleStatus(a);
      const statusB = getOrderLifecycleStatus(b);
      const priorityA = STATUS_PRIORITY[statusA] ?? 99;
      const priorityB = STATUS_PRIORITY[statusB] ?? 99;

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [filteredOrders]);

  const STATUS_PILLS = [
    { id: "ALL", label: "ALL", count: allOrders.length },
    { id: "PLACED", label: "PLACED", count: statusCounts["PLACED"] || 0 },
    { id: "CONFIRMED", label: "CONFIRMED", count: statusCounts["CONFIRMED"] || 0 },
    { id: "ASSIGNED_ARTIST", label: "ASSIGNED", count: statusCounts["ASSIGNED_ARTIST"] || 0 },
    { id: "IN_PROGRESS", label: "IN PROGRESS", count: statusCounts["IN_PROGRESS"] || 0 },
    { id: "COMPLETED", label: "AWAITING INSPECTION", count: needsInspectionCount },
    { id: "PUBLISHED", label: "PUBLISHED", count: inspectedCount },
    { id: "CANCELLED", label: "CANCELLED", count: statusCounts["CANCELLED"] || 0 },
  ] as const;

  const userCounts = useMemo(() => {
    const counts = {
      ALL: allUsers.length,
      CUSTOMER: 0,
      ARTIST: 0,
      ADMIN: 0,
      VERIFIED_ARTIST: 0,
      PENDING_REVIEW: 0,
    };
    for (const u of allUsers) {
      if (u.role === "CUSTOMER") counts.CUSTOMER++;
      else if (u.role === "ARTIST") {
        counts.ARTIST++;
        if (u.is_verified_artist) {
          counts.VERIFIED_ARTIST++;
        } else {
          counts.PENDING_REVIEW++;
        }
      } else if (u.role === "ADMIN") counts.ADMIN++;
    }
    return counts;
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (userRoleFilter === "CUSTOMER" && u.role !== "CUSTOMER") return false;
      if (userRoleFilter === "ADMIN" && u.role !== "ADMIN") return false;
      if (userRoleFilter === "ARTIST") {
        if (u.role !== "ARTIST") return false;
        if (artistStatusFilter === "VERIFIED" && !u.is_verified_artist) return false;
        if (artistStatusFilter === "PENDING_REVIEW" && u.is_verified_artist) return false;
      }

      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const matchName = Boolean(u.full_name?.toLowerCase()?.includes(q));
        const matchEmail = Boolean(u.email?.toLowerCase()?.includes(q));
        const matchUser = Boolean(u.user_name?.toLowerCase()?.includes(q));
        const matchPhone = Boolean(u.phone_number?.toLowerCase()?.includes(q));
        if (!matchName && !matchEmail && !matchUser && !matchPhone) return false;
      }
      return true;
    });
  }, [allUsers, userRoleFilter, artistStatusFilter, userSearchQuery]);

  // Mutations
  const assignMutation = useMutation({
    mutationFn: ({ orderId, artistId }: { orderId: string; artistId: string }) =>
      api(`/api/v1/orders/${orderId}/assign`, {
        method: "POST",
        body: JSON.stringify({ artist_id: artistId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
      setAssigningOrder(null);
      setSelectedArtistId("");
      showMessage("Order assigned to verified artist successfully!");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const statusMutation = useMutation({
    mutationFn: ({ orderId, status, finalUrl }: { orderId: string; status: string; finalUrl?: string }) =>
      api(`/api/v1/admin/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, final_image_url: finalUrl }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
      queryClient.invalidateQueries({ queryKey: ["paintings"] }); // updates public gallery!
      showMessage("Order status updated successfully!");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const confirmGalleryMutation = useMutation({
    mutationFn: (orderId: string) =>
      api(`/api/v1/admin/orders/${orderId}/confirm-gallery`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_orders"] });
      queryClient.invalidateQueries({ queryKey: ["paintings"] });
      showMessage("Artwork confirmed and published to gallery successfully!");
      if (inspectingOrder) {
        setInspectingOrder(null);
      }
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const verifyArtistMutation = useMutation({
    mutationFn: (artistId: string) =>
      api(`/api/admin/verify-artist/${artistId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_review_queue"] });
      queryClient.invalidateQueries({ queryKey: ["verified_artists"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      showMessage("Artist verified & account activated successfully!");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const rejectArtistMutation = useMutation({
    mutationFn: ({ artistId, reason }: { artistId: string; reason: string }) =>
      api(`/api/admin/reject-artist/${artistId}`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_review_queue"] });
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      setRejectingArtist(null);
      setRejectReason("");
      showMessage("Artist rejected with feedback.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  function resolveImage(url?: string) {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "PUBLISHED":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "COMPLETED":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
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

  return (
    <div className="space-y-8">
      {/* Top Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 p-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Authenticated as {user?.email}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1.5">Art Studio Operations & Control</h1>
          <p className="text-sm text-slate-400">
            Manage customer orders, assign work to verified artists, and review new artist applications.
          </p>
        </div>

        {/* Quick Stats & Tab Switchers */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleTabChange("orders")}
            className={`rounded-xl px-5 py-2.5 text-center transition border cursor-pointer ${
              activeTab === "orders"
                ? "bg-slate-800 border-brand shadow-lg ring-1 ring-brand/50"
                : "bg-slate-800/80 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            <p className={`text-xs uppercase tracking-wider font-semibold ${
              activeTab === "orders" ? "text-brand" : "text-slate-400"
            }`}>
              Orders
            </p>
            <p className="text-xl font-bold text-white">{allOrders.length}</p>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("users")}
            className={`rounded-xl px-5 py-2.5 text-center transition border cursor-pointer ${
              activeTab === "users"
                ? "bg-slate-800 border-brand shadow-lg ring-1 ring-brand/50"
                : "bg-slate-800/80 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            <p className={`text-xs uppercase tracking-wider font-semibold ${
              activeTab === "users" ? "text-brand" : "text-emerald-400"
            }`}>
              Users
            </p>
            <p className="text-xl font-bold text-emerald-300">{allUsers.length}</p>
          </button>
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionMessage && (
        <div
          className={`rounded-xl border p-4 text-sm font-medium transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-950/70 border-emerald-600/60 text-emerald-300"
              : "bg-rose-950/70 border-rose-600/60 text-rose-300"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-800 text-sm font-medium">
        <button
          onClick={() => handleTabChange("orders")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "orders"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>📦 Orders</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{allOrders.length}</span>
        </button>
        <button
          onClick={() => handleTabChange("users")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "users"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>👥 Users</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{allUsers.length}</span>
          {userCounts.PENDING_REVIEW > 0 && (
            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold">
              {userCounts.PENDING_REVIEW} in review
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: ORDERS MANAGEMENT */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
            {/* Status Filter Pills (Aligned on single line in lifecycle sequence) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {STATUS_PILLS.map((pill) => {
                const isActive = statusFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => handleStatusFilterChange(pill.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                      isActive
                        ? "bg-slate-700 text-white font-semibold border border-slate-500 shadow-sm"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive
                          ? "bg-slate-900 text-white"
                          : pill.id === "COMPLETED" && needsInspectionCount > 0
                          ? "bg-amber-500/30 text-amber-300 border border-amber-500/50"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search and Secondary Filter */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/60 text-xs">
              {/* Search Bar */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <span className="text-slate-400">🔍</span>
                <input
                  type="text"
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  placeholder="Search orders by ID, category, address, notes, artist..."
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand w-full"
                />
                {orderSearchQuery && (
                  <button
                    onClick={() => setOrderSearchQuery("")}
                    className="text-slate-400 hover:text-white text-xs underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Artist Filter (Visible for active production lifecycle statuses) */}
              {showArtistFilter && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Artist:</span>
                  <select
                    value={artistFilter}
                    onChange={(e) => setArtistFilter(e.target.value)}
                    className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand"
                  >
                    <option value="ALL">All Artists</option>
                    <option value="ASSIGNED">Any Assigned Artist</option>
                    <option value="UNASSIGNED">Unassigned Only</option>
                    {verifiedArtists.map((a) => (
                      <option key={a.artist_id} value={a.artist_id}>
                        {a.full_name} ({a.specialization || "Artist"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Reset filters shortcut */}
              {(statusFilter !== "ALL" || (showArtistFilter && artistFilter !== "ALL") || orderSearchQuery.trim() !== "") && (
                <button
                  onClick={() => {
                    setStatusFilter("ALL");
                    setArtistFilter("ALL");
                    setOrderSearchQuery("");
                  }}
                  className="text-amber-400 hover:text-amber-300 underline font-medium"
                >
                  Clear all filters
                </button>
              )}

              <span className="text-slate-400 text-xs ml-auto">
                Showing <strong className="text-white">{sortedOrders.length}</strong> of{" "}
                <strong className="text-white">{allOrders.length}</strong> orders
              </span>
            </div>
          </div>

          {ordersLoading ? (
            <p className="text-center py-12 text-slate-400 text-sm">Loading orders...</p>
          ) : sortedOrders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
              <p className="text-slate-300 font-medium">No orders match the selected filters.</p>
              <p className="text-xs text-slate-500">
                Status: {statusFilter}
                {showArtistFilter && artistFilter !== "ALL" ? ` | Artist: ${artistFilter}` : ""}
                {orderSearchQuery ? ` | Search: "${orderSearchQuery}"` : ""}
              </p>
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setArtistFilter("ALL");
                  setOrderSearchQuery("");
                }}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {sortedOrders.map((o, index) => {
                const displayStatus = getOrderLifecycleStatus(o);
                const prevStatus = index > 0 ? getOrderLifecycleStatus(sortedOrders[index - 1]) : null;
                const isFirstOfStatus = prevStatus !== displayStatus;
                const assignedArtist = verifiedArtists.find((a) => a.artist_id === o.artist_id);
                return (
                  <div key={o.order_id} className="space-y-3">
                    {statusFilter === "ALL" && isFirstOfStatus && (
                      <div className={`flex items-center gap-3 ${index > 0 ? "pt-5" : "pt-1"} pb-1`}>
                        <span
                          className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${getStatusBadge(
                            displayStatus
                          )}`}
                        >
                          {displayStatus.replace("_", " ")}
                        </span>
                        <div className="h-px bg-slate-800/80 flex-1" />
                      </div>
                    )}
                    <div
                      className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start justify-between"
                    >
                      {/* Left: Thumbnail & Core Details */}
                      <div className="flex gap-4 items-start w-full md:w-auto">
                        {/* Left: Thumbnail Preview (Reference image until published, except when waiting for admin inspection) */}
                        {o.status === "COMPLETED" && (o.collage_image_url || o.final_image_url) ? (
                          <CollageThumbnail
                            sizeClass="w-20 aspect-[4/5] sm:w-24 sm:aspect-[4/5]"
                            finalImageUrl={resolveImage(o.original_final_image_url || o.final_image_url!)}
                            refImageUrl={o.reference_image_url ? resolveImage(o.reference_image_url) : undefined}
                            collageImageUrl={o.collage_image_url ? resolveImage(o.collage_image_url) : undefined}
                            onClick={() => setInspectingOrder(o)}
                          />
                        ) : (
                          <div
                            onClick={() => setSelectedPhoto(resolveImage(o.reference_image_url || "/uploads/customer_ref_photo.jpg"))}
                            className="relative w-20 aspect-[4/5] sm:w-24 sm:aspect-[4/5] rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 cursor-pointer border border-slate-700 group shadow"
                            title="Click to view full reference photo"
                          >
                            <img
                              src={resolveImage(o.reference_image_url || "/uploads/customer_ref_photo.jpg")}
                              alt="Customer Reference"
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = `${API_URL}/uploads/customer_ref_photo.jpg`;
                              }}
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white">
                              View Ref
                            </div>
                          </div>
                        )}

                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(
                                displayStatus
                              )}`}
                            >
                              {displayStatus.replace("_", " ")}
                            </span>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                            {o.painting_category}
                          </span>
                          <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
                            {o.size} • {o.persons_included}
                          </span>
                        </div>

                        <p className="text-lg font-bold text-white">₹{Number(o.total_price).toLocaleString("en-IN")}</p>

                        <div className="text-xs text-slate-400 space-y-0.5">
                          <p>
                            <strong className="text-slate-300">Delivery Address:</strong> {o.delivery_address}
                          </p>
                          {o.customer_notes && (
                            <p>
                              <strong className="text-slate-300">Notes:</strong>{" "}
                              <span className="italic text-slate-300">"{o.customer_notes}"</span>
                            </p>
                          )}
                          <p>
                            <strong className="text-slate-300">Assigned Artist:</strong>{" "}
                            {assignedArtist ? (
                              <span className="text-emerald-400 font-semibold">{assignedArtist.full_name}</span>
                            ) : o.artist_id ? (
                              <span className="text-slate-300">ID: {o.artist_id.slice(0, 8)}</span>
                            ) : (
                              <span className="text-amber-400 font-medium">Unassigned</span>
                            )}
                          </p>
                        </div>

                        {o.status === "ASSIGNED_ARTIST" && (
                          <div className="pt-1">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 text-xs text-purple-300 font-medium">
                              <span>⏳</span> Assigned to {assignedArtist?.full_name || "Artist"} (Awaiting Artist Confirmation)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions Bar */}
                    <div className="flex flex-wrap md:flex-col items-stretch md:items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 flex-shrink-0">
                      {/* 1. If PLACED (Unconfirmed / Unpaid): Only allow Confirming Order (Cancel is customer-initiated only) */}
                      {o.status === "PLACED" && (
                        <button
                          onClick={() => statusMutation.mutate({ orderId: o.order_id, status: "CONFIRMED" })}
                          disabled={statusMutation.isPending}
                          className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-black transition flex items-center justify-center gap-1 shadow-sm whitespace-nowrap flex-shrink-0"
                        >
                          <span>✓</span> Confirm Order
                        </button>
                      )}

                      {/* 2. If CONFIRMED: Payment is verified, admin assigns artist (cancel order is hidden) */}
                      {o.status === "CONFIRMED" && (
                        <button
                          onClick={() => {
                            setAssigningOrder(o);
                            setSelectedArtistId("");
                          }}
                          className="rounded-lg bg-brand hover:bg-brand/90 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap flex-shrink-0"
                        >
                          <span>👤</span> Assign Artist
                        </button>
                      )}

                      {/* 3. If ASSIGNED_ARTIST: Waiting for artist confirmation */}

                      {/* 4. If IN_PROGRESS: Artist is actively drawing */}

                      {/* 5. If COMPLETED: Show ONLY Inspect & Publish button when awaiting inspection */}
                      {o.status === "COMPLETED" && !o.is_published_to_gallery && o.final_image_url && (
                        <button
                          onClick={() => setInspectingOrder(o)}
                          className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 px-3.5 py-1.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap flex-shrink-0"
                          title="Inspect finished artwork and publish to gallery"
                        >
                          <span>👁️</span> Inspect & Publish
                        </button>
                      )}

                      {/* 6. If CANCELLED: Archived */}
                      {o.status === "CANCELLED" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/80 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400">
                          Archived (Cancelled)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PLATFORM USERS MANAGEMENT */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Filters & Search Bar */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 space-y-3">
            {/* Role Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {(
                [
                  { id: "ALL", label: "ALL", count: userCounts.ALL },
                  { id: "CUSTOMER", label: "CUSTOMERS", count: userCounts.CUSTOMER },
                  { id: "ARTIST", label: "ARTISTS", count: userCounts.ARTIST },
                  { id: "ADMIN", label: "ADMINS", count: userCounts.ADMIN },
                ] as const
              ).map((pill) => {
                const isActive = userRoleFilter === pill.id;
                return (
                  <button
                    key={pill.id}
                    onClick={() => {
                      setUserRoleFilter(pill.id);
                      if (pill.id !== "ARTIST") {
                        setArtistStatusFilter("ALL");
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                      isActive
                        ? "bg-slate-700 text-white font-semibold border border-slate-500 shadow-sm"
                        : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                        isActive ? "bg-slate-900 text-white" : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {pill.count}
                    </span>
                    {pill.id === "ARTIST" && userCounts.PENDING_REVIEW > 0 && (
                      <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 text-[10px] font-semibold">
                        {userCounts.PENDING_REVIEW} to review
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Artist Status Sub-filters (Visible when ARTISTS is selected) */}
            {userRoleFilter === "ARTIST" && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60 text-xs">
                <span className="text-slate-400 font-medium text-[11px] uppercase tracking-wider">
                  Artist Status:
                </span>
                <button
                  type="button"
                  onClick={() => setArtistStatusFilter("ALL")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    artistStatusFilter === "ALL"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold"
                      : "bg-slate-800 text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  All Artists ({userCounts.ARTIST})
                </button>
                <button
                  type="button"
                  onClick={() => setArtistStatusFilter("VERIFIED")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    artistStatusFilter === "VERIFIED"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                      : "bg-slate-800 text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  ✓ Verified ({userCounts.VERIFIED_ARTIST})
                </button>
                <button
                  type="button"
                  onClick={() => setArtistStatusFilter("PENDING_REVIEW")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    artistStatusFilter === "PENDING_REVIEW"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold"
                      : "bg-slate-800 text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  ⏳ Pending Review ({userCounts.PENDING_REVIEW})
                </button>
              </div>
            )}

            {/* Search and Summary */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-800/60 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <span className="text-slate-400">🔍</span>
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search users by name, email, phone, username..."
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand w-full"
                />
                {userSearchQuery && (
                  <button
                    onClick={() => setUserSearchQuery("")}
                    className="text-slate-400 hover:text-white text-xs underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              <span className="text-slate-400 text-xs ml-auto">
                Showing <strong className="text-white">{filteredUsers.length}</strong> of{" "}
                <strong className="text-white">{allUsers.length}</strong> users
              </span>
            </div>
          </div>

          {/* Users List */}
          {usersLoading ? (
            <p className="text-center py-12 text-slate-400 text-sm">Loading platform users...</p>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center space-y-3">
              <p className="text-slate-300 font-medium">No users found matching current filters.</p>
              <button
                onClick={() => {
                  setUserRoleFilter("ALL");
                  setArtistStatusFilter("ALL");
                  setUserSearchQuery("");
                }}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredUsers.map((u) => {
                const isArtist = u.role === "ARTIST";
                const isPendingArtist = isArtist && !u.is_verified_artist;
                const initials = u.full_name
                  ? u.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U";

                return (
                  <div
                    key={u.user_id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start justify-between"
                  >
                    {/* Left: Avatar & Details */}
                    <div className="flex gap-4 items-start w-full md:w-auto flex-1">
                      {/* Avatar */}
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 shadow border ${
                          u.role === "ADMIN"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : isArtist
                            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                        }`}
                      >
                        {initials}
                      </div>

                      {/* Content */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-white">{u.full_name}</h3>

                          {/* Role Badge */}
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                              u.role === "ADMIN"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : isArtist
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                            }`}
                          >
                            {u.role}
                          </span>

                          {/* Account Status Badge */}
                          <span
                            className={`rounded-full border px-2 py-0.2 text-[10px] font-semibold ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : u.status === "PENDING"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                            }`}
                          >
                            {u.status}
                          </span>

                          {/* Artist Verification Status */}
                          {isArtist && (
                            <span
                              className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                u.is_verified_artist
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                  : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              }`}
                            >
                              {u.is_verified_artist ? "✓ Verified Artist" : "⏳ Pending Review"}
                            </span>
                          )}
                        </div>

                        {/* Contact details */}
                        <div className="text-xs text-slate-400 space-y-0.5">
                          <p>
                            <strong className="text-slate-300">Email:</strong> {u.email}
                            {u.user_name && <span className="ml-2 text-slate-500">(@{u.user_name})</span>}
                          </p>
                          {u.phone_number && (
                            <p>
                              <strong className="text-slate-300">Phone:</strong> {u.phone_number}
                            </p>
                          )}
                          {u.address && (
                            <p>
                              <strong className="text-slate-300">Address:</strong> {u.address}
                            </p>
                          )}

                          {/* Role-specific statistics */}
                          {u.role === "CUSTOMER" && (
                            <p className="text-blue-300 font-medium pt-0.5">
                              <span>📦</span> {u.orders_count} portrait order{u.orders_count === 1 ? "" : "s"} placed
                            </p>
                          )}

                          {isArtist && (
                            <div className="space-y-0.5 pt-0.5">
                              <p className="text-purple-300 font-medium">
                                <span>🎨</span> {u.assigned_orders_count} commission{u.assigned_orders_count === 1 ? "" : "s"} assigned •{" "}
                                {u.experience_years} year{u.experience_years === 1 ? "" : "s"} experience
                              </p>
                              {u.bio && (
                                <p className="italic text-slate-300 bg-slate-800/40 rounded-lg p-2.5 border border-slate-800 mt-1">
                                  "{u.bio}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions (for pending review artists) */}
                    {isPendingArtist && (
                      <div className="flex flex-wrap md:flex-col items-stretch md:items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 flex-shrink-0">
                        <button
                          onClick={() => verifyArtistMutation.mutate(u.user_id)}
                          disabled={verifyArtistMutation.isPending}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap flex-shrink-0"
                        >
                          <span>✓</span> {verifyArtistMutation.isPending ? "Approving..." : "Approve & Verify"}
                        </button>
                        <button
                          onClick={() => {
                            setRejectingArtist({
                              artist_id: u.user_id,
                              full_name: u.full_name,
                              user_name: u.user_name,
                              bio: u.bio,
                              experience_years: u.experience_years,
                              paintings_count: 0,
                              created_at: u.created_at,
                            });
                            setRejectReason("");
                          }}
                          className="rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-3.5 py-1.5 text-xs font-semibold text-rose-300 transition flex items-center justify-center gap-1 whitespace-nowrap flex-shrink-0"
                        >
                          <span>✕</span> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ASSIGN / REASSIGN ARTIST */}
      {assigningOrder && (() => {
        const isReassign = Boolean(assigningOrder.artist_id);
        const currentArtist = verifiedArtists.find((a) => a.artist_id === assigningOrder.artist_id);
        // Exclude currently assigned artist so the same artist cannot be reassigned
        const eligibleArtists = isReassign
          ? verifiedArtists.filter((a) => a.artist_id !== assigningOrder.artist_id)
          : verifiedArtists;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white">
                {isReassign ? "Reassign Order to a Different Artist" : "Assign Order to Artist"}
              </h3>

              {isReassign ? (
                <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 space-y-1">
                  <p>
                    ⚠️ Currently assigned to: <strong>{currentArtist?.full_name || "Artist"}</strong> (Awaiting start).
                  </p>
                  <p className="text-slate-300">
                    Select a <strong>different</strong> verified artist to take over this {assigningOrder.painting_category} portrait.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Select an approved artist to create this {assigningOrder.painting_category} portrait.
                </p>
              )}

              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Select {isReassign ? "New Different" : ""} Artist</span>
                <select
                  value={selectedArtistId}
                  onChange={(e) => setSelectedArtistId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
                >
                  <option value="">
                    {isReassign ? "-- Choose a Different Artist --" : "-- Choose Artist --"}
                  </option>
                  {eligibleArtists.map((a) => (
                    <option key={a.artist_id} value={a.artist_id}>
                      {a.full_name} ({a.experience_years} yrs exp)
                    </option>
                  ))}
                  {eligibleArtists.length === 0 && (
                    <option disabled value="">
                      No other verified artists available to reassign
                    </option>
                  )}
                </select>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAssigningOrder(null);
                    setSelectedArtistId("");
                  }}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedArtistId || assignMutation.isPending}
                  onClick={() =>
                    assignMutation.mutate({
                      orderId: assigningOrder.order_id,
                      artistId: selectedArtistId,
                    })
                  }
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {assignMutation.isPending
                    ? isReassign
                      ? "Reassigning..."
                      : "Assigning..."
                    : isReassign
                    ? "Confirm Reassignment"
                    : "Confirm Assignment"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}


      {/* MODAL: REJECT ARTIST */}
      {rejectingArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-rose-300">Reject Artist Application</h3>
            <p className="text-xs text-slate-400">
              Rejecting <strong className="text-white">{rejectingArtist.full_name}</strong>. Please provide a clear
              reason so the artist can improve and reapply.
            </p>

            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Rejection Reason</span>
              <textarea
                rows={3}
                placeholder="e.g., Please upload higher resolution samples of your hand-drawn sketches."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingArtist(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReason.trim() || rejectArtistMutation.isPending}
                onClick={() =>
                  rejectArtistMutation.mutate({
                    artistId: rejectingArtist.artist_id,
                    reason: rejectReason.trim(),
                  })
                }
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {rejectArtistMutation.isPending ? "Rejecting..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COLLAGE ARTWORK INSPECTION MODAL */}
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
          artistName={verifiedArtists.find((a) => a.artist_id === inspectingOrder.artist_id)?.full_name}
          isPublishedToGallery={inspectingOrder.is_published_to_gallery}
          onConfirmPublish={() => confirmGalleryMutation.mutate(inspectingOrder.order_id)}
          isConfirming={confirmGalleryMutation.isPending}
        />
      )}

      {/* PHOTO PREVIEW MODAL */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={selectedPhoto} alt="Preview" className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <p className="text-center text-xs text-slate-400 mt-2">Click anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
