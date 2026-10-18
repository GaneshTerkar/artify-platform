import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api, API_URL } from "../lib/api";
import { useAuth } from "../lib/auth";
import PhotoUploader from "../components/PhotoUploader";
import { CollageThumbnail } from "../components/CollageThumbnail";
import { CollageArtworkModal } from "../components/CollageArtworkModal";
import type { Order } from "../types/order";

export default function AccountPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isArtist = user?.role === "ARTIST";
  const isDelivery = user?.role === "DELIVERY_AGENT";

  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<Order | null>(null);
  const [completingOrder, setCompletingOrder] = useState<Order | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string>("");
  const [failingOrder, setFailingOrder] = useState<Order | null>(null);
  const [selectedFailurePreset, setSelectedFailurePreset] = useState<string>("Customer unavailable / phone unreachable");
  const [customFailureNotes, setCustomFailureNotes] = useState<string>("");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  function showMessage(text: string, type: "success" | "error" = "success") {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  }

  // Fetch orders (customer orders, assigned artist commissions, or assigned deliveries)
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-orders"],
    queryFn: () => api<{ orders: Order[] }>("/api/v1/orders"),
  });

  const orders = data?.orders ?? [];

  // Mutation to update order status (e.g. Start Drawing, Complete Artwork, Out for Delivery, Delivery Failed, Delivered)
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

  function resolveImage(url?: string) {
    if (!url) return "";
    return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
  }

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
                ? "My Assigned Commissions"
                : isDelivery
                ? "🚚 Logistics & Doorstep Deliveries"
                : "Your Orders"}
            </h1>
            {isArtist && (
              <span className="rounded-full bg-purple-500/20 border border-purple-500/40 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                🎨 Artist Studio
              </span>
            )}
            {isDelivery && (
              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                🚚 Delivery Partner
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {isArtist
              ? "Manage portrait sketch orders assigned to you. Start drawings and upload completed sketches."
              : isDelivery
              ? "Manage assigned portrait deliveries, dispatch packages from the studio, update live transit milestones, and record handovers."
              : "Track progress of your personalized handmade portrait commissions."}
          </p>
        </div>

        <div>
          {!isArtist && !isDelivery && user?.role !== "ADMIN" && (
            <Link
              to="/order"
              className="rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 transition"
            >
              + New Order
            </Link>
          )}
        </div>
      </div>

      {/* Orders List */}
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
          {!isArtist && !isDelivery && (
            <Link
              to="/"
              className="inline-block mt-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
            >
              Browse Gallery
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => {
            const hasRef = Boolean(o.reference_image_url);
            // Show final collage ONLY when published to gallery, EXCEPT when artist is viewing their own work
            const showFinalCollage = isArtist
              ? Boolean(o.final_image_url || o.collage_image_url)
              : Boolean(o.is_published_to_gallery && (o.collage_image_url || o.final_image_url));

            return (
              <div
                key={o.order_id}
                className="rounded-2xl border border-slate-800 bg-brand-muted p-5 shadow-sm space-y-4"
              >
                {/* Header row: ID, Category, Date, Status */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">#{o.order_id.slice(0, 8)}</span>
                    <span className="rounded-lg bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                      {o.painting_category}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(o.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Status Pill */}
                  <div>
                    {o.status === "PLACED" && (
                      <span className="rounded-full bg-amber-950/70 border border-amber-500/50 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                        Placed (Payment Pending)
                      </span>
                    )}
                    {o.status === "CONFIRMED" && (
                      <span className="rounded-full bg-cyan-950/70 border border-cyan-500/50 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                        Payment Confirmed
                      </span>
                    )}
                    {o.status === "ASSIGNED_ARTIST" && (
                      <span className="rounded-full bg-purple-950/70 border border-purple-500/50 px-2.5 py-0.5 text-xs font-semibold text-purple-300">
                        Assigned to Artist
                      </span>
                    )}
                    {o.status === "IN_PROGRESS" && (
                      <span className="rounded-full bg-blue-950/70 border border-blue-500/50 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                        Drawing in Progress
                      </span>
                    )}
                    {o.status === "COMPLETED" && (
                      <span className="rounded-full bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                        ✓ Completed & Inspected
                      </span>
                    )}
                    {o.status === "ASSIGNED_DELIVERY_AGENT" && (
                      <span className="rounded-full bg-cyan-950/70 border border-cyan-500/50 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                        🚚 Courier Assigned
                      </span>
                    )}
                    {o.status === "IN_TRANSIT" && (
                      <span className="rounded-full bg-indigo-950/70 border border-indigo-500/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-300">
                        🛫 In Transit
                      </span>
                    )}
                    {o.status === "OUT_FOR_DELIVERY" && (
                      <span className="rounded-full bg-sky-950/70 border border-sky-500/50 px-2.5 py-0.5 text-xs font-semibold text-sky-300 animate-pulse">
                        🛵 Out for Delivery
                      </span>
                    )}
                    {o.status === "DELIVERY_FAILED" && (
                      <span className="rounded-full bg-rose-950/70 border border-rose-500/50 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                        ⚠️ Delivery Attempt Failed (#{o.delivery_attempts || 1})
                      </span>
                    )}
                    {o.status === "DELIVERED" && (
                      <span className="rounded-full bg-teal-950/70 border border-teal-500/50 px-2.5 py-0.5 text-xs font-semibold text-teal-300">
                        ✓ Delivered
                      </span>
                    )}
                    {o.status === "PUBLISHED" && (
                      <span className="rounded-full bg-emerald-950/70 border border-emerald-500/50 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                        ✓ Published
                      </span>
                    )}
                    {o.status === "CANCELLED" && (
                      <span className="rounded-full bg-rose-950/70 border border-rose-500/50 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Body: Photos & Specs */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
                  {/* Photo Thumbnail */}
                  <div className="flex items-center gap-3 md:col-span-1">
                    {showFinalCollage ? (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-emerald-400 mb-1">
                          {o.collage_image_url ? "Artwork Collage" : "Final Artwork"}
                        </p>
                        <CollageThumbnail
                          sizeClass="w-20 aspect-[4/5]"
                          finalImageUrl={resolveImage(o.original_final_image_url || o.final_image_url!)}
                          refImageUrl={o.reference_image_url ? resolveImage(o.reference_image_url) : undefined}
                          collageImageUrl={o.collage_image_url ? resolveImage(o.collage_image_url) : undefined}
                          onClick={() => setInspectingOrder(o)}
                          badgeText={o.is_published_to_gallery ? "Published" : isArtist ? "Submitted" : "Final"}
                        />
                      </div>
                    ) : (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">
                          {isArtist ? "Client Photo" : "Reference Photo"}
                        </p>
                        <div
                          onClick={() => setSelectedPhoto(resolveImage(o.reference_image_url || "/uploads/customer_ref_photo.jpg"))}
                          className="w-20 aspect-[4/5] rounded-xl overflow-hidden border border-slate-700 bg-slate-900 cursor-pointer hover:border-slate-500 transition"
                        >
                          <img
                            src={resolveImage(o.reference_image_url || "/uploads/customer_ref_photo.jpg")}
                            alt="Reference"
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = `${API_URL}/uploads/customer_ref_photo.jpg`;
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Specifications */}
                  <div className="space-y-1.5 md:col-span-2 text-xs">
                    <div className="flex flex-wrap gap-4 text-slate-300">
                      <span>
                        Size: <strong className="text-white">{o.size}</strong>
                      </span>
                      <span>
                        Persons: <strong className="text-white">{o.persons_included}</strong>
                      </span>
                      <span>
                        Total: <strong className="text-brand">₹{o.total_price}</strong>
                      </span>
                    </div>

                    {o.customer_notes && (
                      <p className="text-slate-400 pt-1">
                        <strong className="text-slate-300">Notes:</strong> {o.customer_notes}
                      </p>
                    )}

                    <div className="text-slate-400 flex items-start gap-1">
                      <strong className="text-slate-300 flex-shrink-0">Delivery:</strong>{" "}
                      <span>{o.delivery_address}</span>
                      {o.delivery_address && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.delivery_address)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-1 inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 text-[11px] underline flex-shrink-0"
                          title="Open navigation map"
                        >
                          🗺️ Map
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col items-start md:items-end justify-between gap-2 md:col-span-1 h-full">
                    {/* ARTIST ACTIONS */}
                    {isArtist && (
                      <div className="flex flex-col items-stretch md:items-end gap-2 w-full">
                        {/* 1. Confirm or Decline (if Assigned) */}
                        {o.status === "ASSIGNED_ARTIST" && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={() =>
                                statusMutation.mutate({ orderId: o.order_id, status: "IN_PROGRESS" })
                              }
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>✓</span> Confirm & Start Drawing
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Are you sure you cannot accept this order? The order will be reverted to Confirmed for admin reassignment.")) {
                                  statusMutation.mutate({ orderId: o.order_id, status: "CONFIRMED" });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:text-rose-300 transition flex items-center justify-center gap-1"
                            >
                              <span>✕</span> Decline
                            </button>
                          </div>
                        )}

                        {/* 2. Complete & Upload Sketch (if In Progress) */}
                        {o.status === "IN_PROGRESS" && (
                          <button
                            type="button"
                            onClick={() => {
                              setCompletingOrder(o);
                              setFinalImageUrl(o.final_image_url || "");
                            }}
                            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>✓</span> Complete & Upload Sketch
                          </button>
                        )}

                        {/* 3. Completed State */}
                        {o.status === "COMPLETED" && (
                          o.is_published_to_gallery ? (
                            <span className="text-xs text-emerald-400 font-medium text-right flex items-center gap-1">
                              <span>✓</span> Published to Gallery after confirmation from Admin
                            </span>
                          ) : (
                            <span className="text-xs text-amber-300 font-medium text-right flex items-center gap-1">
                              <span>⏳</span> Artwork Inspected & Ready for Packaging
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {/* DELIVERY AGENT ACTIONS */}
                    {isDelivery && (
                      <div className="flex flex-col items-stretch md:items-end gap-2 w-full">
                        {/* 1. Pick Up Package (if Courier Assigned) */}
                        {o.status === "ASSIGNED_DELIVERY_AGENT" && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={() =>
                                statusMutation.mutate({ orderId: o.order_id, status: "IN_TRANSIT" })
                              }
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>📦</span> Pick Up & Dispatch (In-Transit)
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                statusMutation.mutate({ orderId: o.order_id, status: "OUT_FOR_DELIVERY" })
                              }
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>🛵</span> Direct Out for Delivery
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Cannot deliver this order? It will revert back to assign a delivery agent.")) {
                                  statusMutation.mutate({ orderId: o.order_id, status: "COMPLETED" });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3 py-2 text-xs font-semibold text-rose-300 transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>✕</span> Decline
                            </button>
                          </div>
                        )}

                        {/* 2. In Transit -> Out for Delivery */}
                        {o.status === "IN_TRANSIT" && (
                          <button
                            type="button"
                            onClick={() =>
                              statusMutation.mutate({ orderId: o.order_id, status: "OUT_FOR_DELIVERY" })
                            }
                            disabled={statusMutation.isPending}
                            className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                          >
                            <span>🛵</span> Out for Delivery Today
                          </button>
                        )}

                        {/* 3. Out for Delivery -> Mark Delivered OR Delivery Failed */}
                        {o.status === "OUT_FOR_DELIVERY" && (
                          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Confirm that parcel has been safely handed over to the customer?")) {
                                  statusMutation.mutate({ orderId: o.order_id, status: "DELIVERED" });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>✅</span> Confirm Handover (Delivered)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setFailingOrder(o);
                                setSelectedFailurePreset("Customer unavailable / phone unreachable");
                                setCustomFailureNotes("");
                              }}
                              disabled={statusMutation.isPending}
                              className="rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3 py-2 text-xs font-semibold text-rose-300 transition flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>✕</span> Attempt Failed
                            </button>
                          </div>
                        )}

                        {/* 4. Delivery Failed -> Re-attempt */}
                        {o.status === "DELIVERY_FAILED" && (
                          <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                            <div className="rounded-lg bg-rose-950/60 border border-rose-500/40 p-2.5 text-xs text-rose-200 text-left md:text-right max-w-xs">
                              <p className="font-semibold text-rose-300">⚠️ Attempt {o.delivery_attempts || 1}/3 Failed</p>
                              <p className="text-[11px] text-slate-300 mt-0.5">{o.delivery_failure_reason || "Customer unavailable"}</p>
                            </div>
                            {(o.delivery_attempts || 1) < 3 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  statusMutation.mutate({ orderId: o.order_id, status: "OUT_FOR_DELIVERY" })
                                }
                                disabled={statusMutation.isPending}
                                className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <span>🔁</span> Schedule Re-attempt (Attempt {(o.delivery_attempts || 1) + 1}/3)
                              </button>
                            ) : (
                              <span className="text-xs text-rose-400 font-medium text-right">
                                🛑 Max 3 attempts reached. Return parcel to logistics hub.
                              </span>
                            )}
                          </div>
                        )}

                        {/* 5. Delivered State */}
                        {o.status === "DELIVERED" && (
                          <div className="flex flex-col items-start md:items-end gap-1">
                            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                              <span>✓</span> Handover Verified
                            </span>
                            <span className="text-[11px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded-full px-2.5 py-0.5 font-medium">
                              💰 10% Delivery Fee: ₹{(Number(o.total_price) * 0.10).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* CUSTOMER PREVIEW & DOWNLOAD ACTIONS */}
                    {!isArtist && !isDelivery && (
                      <div className="flex flex-col items-stretch md:items-end gap-2 w-full">
                        {/* 1. Customer can cancel before payment is made (PLACED) */}
                        {o.status === "PLACED" && (
                          <div className="flex flex-col items-stretch md:items-end gap-1.5 w-full">
                            <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 text-right">
                              ⏳ Awaiting Payment
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Are you sure you want to cancel this order?")) {
                                  statusMutation.mutate({ orderId: o.order_id, status: "CANCELLED" });
                                }
                              }}
                              disabled={statusMutation.isPending}
                              className="text-xs text-rose-400 hover:text-rose-300 font-medium py-1 transition flex items-center justify-end gap-1"
                            >
                              ✕ Cancel Order
                            </button>
                          </div>
                        )}

                        {/* 2. Customer preview & download for completed/delivered/published artwork */}
                        {(o.status === "COMPLETED" || o.status === "DELIVERED" || o.status === "PUBLISHED") && (
                          (o.status === "PUBLISHED" || o.is_published_to_gallery) && (o.final_image_url || o.collage_image_url) ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectingOrder(o)}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm"
                              >
                                <span>👁️</span> Preview Sketch & Collage
                              </button>
                              <a
                                href={o.collage_image_url ? resolveImage(o.collage_image_url) : resolveImage(o.final_image_url)}
                                target="_blank"
                                rel="noreferrer"
                                download={`artifyme_${o.collage_image_url ? "collage" : "sketch"}_${o.order_id.slice(0, 8)}.jpg`}
                                className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition inline-flex items-center gap-1"
                              >
                                <span>↓</span> Download {o.collage_image_url ? "Collage" : "Artwork"}
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 text-right">
                              {o.status === "DELIVERED"
                                ? "✓ Package Delivered"
                                : o.status === "PUBLISHED"
                                ? "✓ Artwork Published"
                                : "⏳ Artwork completed & packaged — preparing for delivery dispatch"}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: COMPLETE & UPLOAD SKETCH FOR ARTIST */}
      {completingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🎨</span> Complete & Upload Finished Sketch
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Upload your hand-drawn sketch photo for order{" "}
                <strong className="text-white font-mono">#{completingOrder.order_id.slice(0, 8)}</strong>. Once
                submitted, the customer can download it and it will be showcased in the gallery!
              </p>
            </div>

            {/* Photo Uploader Component with Drag & Drop */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300 block">Finished Portrait Artwork</label>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-brand-muted p-6 shadow-2xl space-y-4">
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
    </div>
  );
}
