import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Order, VerifiedArtist, ArtistReviewItem } from "../types/order";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"orders" | "artists" | "roster">("orders");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Modal states
  const [assigningOrder, setAssigningOrder] = useState<Order | null>(null);
  const [selectedArtistId, setSelectedArtistId] = useState<string>("");

  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string>("");

  const [rejectingArtist, setRejectingArtist] = useState<ArtistReviewItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>("");

  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 4000);
  }

  // 1. Fetch All Platform Orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin_orders", statusFilter],
    queryFn: () => {
      const q = statusFilter !== "ALL" ? `?status=${statusFilter}` : "";
      return api<{ orders: Order[] }>(`/api/v1/admin/orders${q}`);
    },
  });
  const orders = ordersData?.orders ?? [];

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
      setCompletingOrder(null);
      setFinalImageUrl("");
      showMessage("Order status updated! (If completed, published to public gallery)");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const verifyArtistMutation = useMutation({
    mutationFn: (artistId: string) =>
      api(`/api/admin/verify-artist/${artistId}`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_review_queue"] });
      queryClient.invalidateQueries({ queryKey: ["verified_artists"] });
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
      setRejectingArtist(null);
      setRejectReason("");
      showMessage("Artist rejected with feedback.");
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  function resolveImage(url?: string) {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_URL}${url}`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
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
            <span className="inline-flex items-center rounded-md bg-amber-500/20 px-2.5 py-0.5 text-xs font-semibold text-amber-300 border border-amber-500/30">
              Admin Portal
            </span>
            <span className="text-xs text-slate-400">Authenticated as {user?.email}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-1.5">Art Studio Operations & Control</h1>
          <p className="text-sm text-slate-400">
            Manage customer orders, assign work to verified artists, and review new artist applications.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-2.5 text-center">
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Orders</p>
            <p className="text-xl font-bold text-white">{orders.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-2.5 text-center">
            <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold">In Review</p>
            <p className="text-xl font-bold text-amber-300">{pendingArtists.length}</p>
          </div>
          <div className="rounded-xl bg-slate-800/80 border border-slate-700 px-4 py-2.5 text-center">
            <p className="text-xs text-emerald-400 uppercase tracking-wider font-semibold">Artists</p>
            <p className="text-xl font-bold text-emerald-300">{verifiedArtists.length}</p>
          </div>
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
          onClick={() => setActiveTab("orders")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "orders"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>📦 Customer Orders</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{orders.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("artists")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "artists"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>🎨 Artist Review Queue</span>
          {pendingArtists.length > 0 && (
            <span className="rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 text-xs">
              {pendingArtists.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("roster")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "roster"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>👥 Verified Artists Roster</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">{verifiedArtists.length}</span>
        </button>
      </div>

      {/* TAB 1: ORDERS MANAGEMENT */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-1">Filter by status:</span>
            {["ALL", "PLACED", "CONFIRMED", "ASSIGNED_ARTIST", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === status
                      ? "bg-brand text-white shadow-sm"
                      : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {status === "ALL" ? "All Orders" : status.replace("_", " ")}
                </button>
              )
            )}
          </div>

          {ordersLoading ? (
            <p className="text-center py-12 text-slate-400 text-sm">Loading orders...</p>
          ) : orders.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
              <p className="text-slate-300 font-medium">No orders found for status: {statusFilter}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {orders.map((o) => {
                const assignedArtist = verifiedArtists.find((a) => a.artist_id === o.artist_id);
                return (
                  <div
                    key={o.order_id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start justify-between"
                  >
                    {/* Left: Thumbnail & Core Details */}
                    <div className="flex gap-4 items-start w-full md:w-auto">
                      {o.reference_image_url && (
                        <div
                          onClick={() => setSelectedPhoto(resolveImage(o.reference_image_url))}
                          className="relative w-24 h-24 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 cursor-pointer border border-slate-700 group shadow"
                          title="Click to view full reference photo"
                        >
                          <img
                            src={resolveImage(o.reference_image_url)}
                            alt="Customer Reference"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs text-white">
                            View
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-slate-400" title={o.order_id}>
                            #{o.order_id.slice(0, 8)}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadge(
                              o.status
                            )}`}
                          >
                            {o.status.replace("_", " ")}
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

                        {o.final_image_url && (
                          <div className="pt-1 flex items-center gap-2">
                            <span className="text-xs text-emerald-400 font-medium">✦ Finished Artwork:</span>
                            <button
                              onClick={() => setSelectedPhoto(resolveImage(o.final_image_url))}
                              className="text-xs text-brand hover:underline font-medium"
                            >
                              Inspect Final Artwork
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: Actions Bar */}
                    <div className="flex flex-wrap md:flex-col items-stretch md:items-end gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800">
                      {/* Assign Artist Button */}
                      <button
                        onClick={() => {
                          setAssigningOrder(o);
                          setSelectedArtistId(o.artist_id || "");
                        }}
                        className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5"
                      >
                        <span>👤</span> {o.artist_id ? "Reassign Artist" : "Assign Artist"}
                      </button>

                      {/* Confirm Order (if Placed) */}
                      {o.status === "PLACED" && (
                        <button
                          onClick={() => statusMutation.mutate({ orderId: o.order_id, status: "CONFIRMED" })}
                          disabled={statusMutation.isPending}
                          className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-black transition"
                        >
                          Confirm Order
                        </button>
                      )}

                      {/* Start Drawing (if Confirmed or Assigned) */}
                      {(o.status === "CONFIRMED" || o.status === "ASSIGNED_ARTIST") && (
                        <button
                          onClick={() => statusMutation.mutate({ orderId: o.order_id, status: "IN_PROGRESS" })}
                          disabled={statusMutation.isPending}
                          className="rounded-lg bg-blue-600 hover:bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white transition"
                        >
                          Start Drawing
                        </button>
                      )}

                      {/* Complete Artwork (if In Progress or Confirmed) */}
                      {o.status !== "COMPLETED" && o.status !== "CANCELLED" && (
                        <button
                          onClick={() => {
                            setCompletingOrder(o);
                            setFinalImageUrl(o.final_image_url || "");
                          }}
                          className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1"
                        >
                          <span>✓</span> Complete & Publish
                        </button>
                      )}

                      {/* Cancel Order */}
                      {o.status !== "CANCELLED" && o.status !== "COMPLETED" && (
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to cancel this order?")) {
                              statusMutation.mutate({ orderId: o.order_id, status: "CANCELLED" });
                            }
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 py-1 transition"
                        >
                          Cancel Order
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ARTIST REVIEW QUEUE */}
      {activeTab === "artists" && (
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4">
            <h2 className="text-base font-semibold text-white">Artist Review & Verification Queue</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review artist profiles and quality portfolios. Once verified, artists can receive and fulfill customer portrait orders.
            </p>
          </div>

          {queueLoading ? (
            <p className="text-center py-12 text-slate-400 text-sm">Loading review queue...</p>
          ) : pendingArtists.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-12 text-center">
              <span className="text-3xl">✨</span>
              <p className="text-white font-medium mt-2">All artist applications reviewed!</p>
              <p className="text-xs text-slate-400 mt-1">There are no pending artists waiting in the review queue.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingArtists.map((artist) => (
                <div
                  key={artist.artist_id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start justify-between"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{artist.full_name}</h3>
                      <span className="rounded bg-amber-500/20 text-amber-300 text-xs px-2 py-0.5 font-medium border border-amber-500/30">
                        Pending Review
                      </span>
                      <span className="text-xs text-slate-400">@{artist.user_name}</span>
                    </div>

                    <p className="text-xs text-slate-300">
                      <strong>Experience:</strong> {artist.experience_years} years •{" "}
                      <strong>Submitted Artwork:</strong> {artist.paintings_count} paintings
                    </p>

                    {artist.bio && (
                      <p className="text-xs text-slate-400 bg-slate-800/40 rounded-lg p-2.5 border border-slate-800 italic">
                        "{artist.bio}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto">
                    <button
                      onClick={() => verifyArtistMutation.mutate(artist.artist_id)}
                      disabled={verifyArtistMutation.isPending}
                      className="flex-1 md:flex-none rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition shadow"
                    >
                      {verifyArtistMutation.isPending ? "Approving..." : "Approve & Verify"}
                    </button>
                    <button
                      onClick={() => {
                        setRejectingArtist(artist);
                        setRejectReason("");
                      }}
                      className="flex-1 md:flex-none rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 px-4 py-2 text-xs font-semibold text-rose-300 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: VERIFIED ARTISTS ROSTER */}
      {activeTab === "roster" && (
        <div className="space-y-6">
          <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4">
            <h2 className="text-base font-semibold text-white">Active Verified Artists Directory</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              All active artists officially verified to work on customer portrait commissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {verifiedArtists.map((artist) => (
              <div
                key={artist.artist_id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-2 shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-base">{artist.full_name}</h3>
                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-0.5 font-semibold">
                    ✓ Verified
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Email:</strong> {artist.email}
                </p>
                <p className="text-xs text-slate-400">
                  <strong className="text-slate-300">Experience:</strong> {artist.experience_years} years
                </p>
                {artist.bio && (
                  <p className="text-xs text-slate-400 italic bg-slate-800/30 p-2 rounded border border-slate-800">
                    "{artist.bio}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN ARTIST */}
      {assigningOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Assign Order to Verified Artist</h3>
            <p className="text-xs text-slate-400">
              Select an approved verified artist to create this {assigningOrder.painting_category} portrait (Order #
              {assigningOrder.order_id.slice(0, 8)}).
            </p>

            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Select Verified Artist</span>
              <select
                value={selectedArtistId}
                onChange={(e) => setSelectedArtistId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              >
                <option value="">-- Choose Verified Artist --</option>
                {verifiedArtists.map((a) => (
                  <option key={a.artist_id} value={a.artist_id}>
                    {a.full_name} ({a.experience_years} yrs exp)
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAssigningOrder(null)}
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
                {assignMutation.isPending ? "Assigning..." : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: COMPLETE ORDER & ATTACH FINAL ARTWORK */}
      {completingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Complete & Publish Artwork</h3>
            <p className="text-xs text-slate-400">
              Provide the high-resolution final portrait image URL. Once completed, this artwork is{" "}
              <strong className="text-brand">automatically published to the public gallery</strong>!
            </p>

            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Final Painting Image URL or Path</span>
              <input
                type="text"
                placeholder="/paintings/PhotoGrid_1580669157513.jpg or https://..."
                value={finalImageUrl}
                onChange={(e) => setFinalImageUrl(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-white text-sm"
              />
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCompletingOrder(null)}
                className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!finalImageUrl.trim() || statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate({
                    orderId: completingOrder.order_id,
                    status: "COMPLETED",
                    finalUrl: finalImageUrl.trim(),
                  })
                }
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {statusMutation.isPending ? "Completing..." : "Complete & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

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
