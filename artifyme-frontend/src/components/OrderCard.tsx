import React from "react";
import type { Order, VerifiedArtist, ActiveDeliveryAgent, PlatformUser } from "../types/order";
import { CollageThumbnail } from "./CollageThumbnail";
import { API_URL } from "../lib/api";

function resolveImage(url?: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function getOrderStatusBadge(status: string): string {
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

export interface OrderCardProps {
  order: Order;
  role: "ADMIN" | "CUSTOMER" | "ARTIST" | "DELIVERY_AGENT";
  verifiedArtists?: VerifiedArtist[];
  deliveryAgents?: (ActiveDeliveryAgent | PlatformUser)[];
  currentUserName?: string;
  commissionSplit?: { artistPercentage: number; deliveryPercentage: number };

  // Modals & previews
  onInspectCollage?: (order: Order) => void;
  onViewPhoto?: (url: string) => void;

  // Admin actions
  onAdminConfirmOrder?: (order: Order) => void;
  onAdminAssignArtist?: (order: Order) => void;
  onAdminAssignDelivery?: (order: Order) => void;
  onAdminPublish?: (order: Order) => void;
  isPublishing?: boolean;

  // Artist actions
  onArtistAccept?: (order: Order) => void;
  onArtistDecline?: (order: Order) => void;
  onArtistComplete?: (order: Order) => void;

  // Delivery agent actions
  onDeliveryPickUp?: (order: Order) => void;
  onDeliveryDirectOut?: (order: Order) => void;
  onDeliveryDecline?: (order: Order) => void;
  onDeliveryOutToday?: (order: Order) => void;
  onDeliveryDelivered?: (order: Order) => void;
  onDeliveryFailed?: (order: Order) => void;
  onDeliveryReattempt?: (order: Order) => void;

  // Customer actions
  onCustomerPay?: (orderId: string) => void;
  onCustomerCancel?: (orderId: string) => void;
  isPaying?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  role,
  verifiedArtists = [],
  deliveryAgents = [],
  commissionSplit,
  onInspectCollage,
  onViewPhoto,
  onAdminConfirmOrder,
  onAdminAssignArtist,
  onAdminAssignDelivery,
  onAdminPublish,
  isPublishing,
  onArtistAccept,
  onArtistDecline,
  onArtistComplete,
  onDeliveryPickUp,
  onDeliveryDirectOut,
  onDeliveryDecline,
  onDeliveryOutToday,
  onDeliveryDelivered,
  onDeliveryFailed,
  onDeliveryReattempt,
  onCustomerPay,
  onCustomerCancel,
  isPaying,
}) => {
  // Resolve artist and delivery agent
  const assignedArtist = verifiedArtists.find((a) => a.artist_id === order.artist_id);
  const assignedDeliveryAgent = deliveryAgents.find((a) => a.user_id === order.delivery_agent_id);

  const artistName = assignedArtist?.full_name || order.artist_name || (order.artist_id ? `ID: ${order.artist_id.slice(0, 8)}` : undefined);
  const artistPhone = order.artist_phone || assignedArtist?.phone_number;

  const deliveryAgentName = assignedDeliveryAgent?.full_name || order.delivery_agent_name || (order.delivery_agent_id ? `ID: ${order.delivery_agent_id.slice(0, 8)}` : undefined);
  const deliveryAgentPhone = order.delivery_agent_phone || (assignedDeliveryAgent as any)?.phone_number;

  const customerName = order.customer_name || (role === "CUSTOMER" && currentUserName ? currentUserName : undefined);
  const customerPhone = order.customer_phone;

  // Show final composite artwork whenever collage or sketch is ready for post-drawing stages
  const showCollageThumbnail =
    Boolean(order.collage_image_url || order.final_image_url) &&
    !["PLACED", "CONFIRMED", "ASSIGNED_ARTIST", "IN_PROGRESS"].includes(order.status);

  // Determine if there are actual actionable buttons on the right side
  const hasActions =
    (role === "ADMIN" && ["PLACED", "CONFIRMED", "COMPLETED", "DELIVERY_FAILED", "DELIVERED"].includes(order.status)) ||
    (role === "ARTIST" && (order.status === "ASSIGNED_ARTIST" || order.status === "IN_PROGRESS")) ||
    (role === "DELIVERY_AGENT" && ["ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"].includes(order.status)) ||
    (role === "CUSTOMER" && (order.status === "PLACED" || ((order.status === "PUBLISHED" || order.is_published_to_gallery) && Boolean(order.final_image_url || order.collage_image_url))));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg flex flex-col md:flex-row gap-5 items-start justify-between">
      {/* Left Column: Clean Thumbnail & Core Details */}
      <div className="flex gap-4 items-start w-full md:w-auto">
        {/* Thumbnail Preview */}
        {showCollageThumbnail ? (
          <CollageThumbnail
            sizeClass="w-20 aspect-[4/5] sm:w-24 sm:aspect-[4/5]"
            finalImageUrl={resolveImage(order.original_final_image_url || order.final_image_url!)}
            refImageUrl={order.reference_image_url ? resolveImage(order.reference_image_url) : undefined}
            collageImageUrl={order.collage_image_url ? resolveImage(order.collage_image_url) : undefined}
            onClick={() => onInspectCollage?.(order)}
          />
        ) : order.reference_image_url ? (
          <div
            onClick={() => onViewPhoto?.(resolveImage(order.reference_image_url))}
            className="relative w-20 aspect-[4/5] sm:w-24 sm:aspect-[4/5] rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 cursor-pointer border border-slate-700 group shadow flex items-center justify-center"
            title="Click to view reference photo"
          >
            <img
              src={resolveImage(order.reference_image_url)}
              alt="Reference"
              className="w-full h-full object-contain group-hover:scale-105 transition"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white">
              View Ref
            </div>
          </div>
        ) : (
          <div
            className="relative w-20 aspect-[4/5] sm:w-24 sm:aspect-[4/5] rounded-xl overflow-hidden bg-slate-800/60 flex-shrink-0 border border-slate-700/60 flex flex-col items-center justify-center text-slate-500 text-[11px] select-none p-1 text-center"
            title="No photo attached"
          >
            <span className="text-xl mb-1">🖼️</span>
            <span>No Photo</span>
          </div>
        )}

        {/* Core Specs & Details */}
        <div className="space-y-1.5 flex-1">
          {/* Top Badges Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pill: hide for delivery agent when ASSIGNED_DELIVERY_AGENT */}
            {!(role === "DELIVERY_AGENT" && order.status === "ASSIGNED_DELIVERY_AGENT") && (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getOrderStatusBadge(
                  order.status
                )}`}
              >
                {role === "ARTIST" && order.status === "COMPLETED"
                  ? "Collage Processing"
                  : order.status.replace("_", " ")}
              </span>
            )}
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
              {order.painting_category}
            </span>
            <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
              {order.size} • {order.persons_included}
            </span>
          </div>

          {/* Price Line */}
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="text-lg font-bold text-white">
              ₹{Number(order.total_price).toLocaleString("en-IN")}
            </p>
            {role === "ARTIST" && commissionSplit && (
              <span className="text-[11px] text-purple-300 bg-purple-950/60 border border-purple-500/30 rounded-md px-2 py-0.5 font-medium">
                Payout: ₹{Math.round(Number(order.total_price) * (commissionSplit.artistPercentage / 100)).toLocaleString("en-IN")} ({commissionSplit.artistPercentage}%)
              </span>
            )}
            {role === "DELIVERY_AGENT" && commissionSplit && (
              <span className="text-[11px] text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded-md px-2 py-0.5 font-medium">
                Delivery Fee: ₹{(Number(order.total_price) * (commissionSplit.deliveryPercentage / 100)).toFixed(2)} ({commissionSplit.deliveryPercentage}%)
              </span>
            )}
          </div>

          {/* Details (Strictly minimal and role-relevant) */}
          <div className="text-xs text-slate-400 space-y-0.5">
            {/* Customer Details */}
            {(customerName || customerPhone) && (
              <p>
                <strong className="text-slate-300">Customer:</strong>{" "}
                <span className="text-slate-200 font-medium">{customerName || "Customer"}</span>
                {customerPhone && (
                  <span className="text-slate-400 ml-1.5 font-normal">
                    (📞{" "}
                    <a
                      href={`tel:${customerPhone}`}
                      className="text-cyan-400 hover:text-cyan-300 underline"
                      title="Call customer"
                    >
                      {customerPhone}
                    </a>
                    )
                  </span>
                )}
              </p>
            )}

            {order.delivery_address && (
              <p>
                <strong className="text-slate-300">Delivery Address:</strong> {order.delivery_address}
                {role === "DELIVERY_AGENT" && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1.5 inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                    title="Open navigation map"
                  >
                    🗺️ Map
                  </a>
                )}
              </p>
            )}

            {order.customer_notes && (
              <p>
                <strong className="text-slate-300">Notes:</strong>{" "}
                <span className="italic text-slate-300">"{order.customer_notes}"</span>
              </p>
            )}

            {/* Assigned Artist */}
            {(role === "ADMIN" || role === "CUSTOMER" || role === "DELIVERY_AGENT" || (role === "ARTIST" && (artistName || order.artist_id))) && (
              <p>
                <strong className="text-slate-300">Assigned Artist:</strong>{" "}
                {artistName ? (
                  <>
                    <span className="text-emerald-400 font-semibold">{artistName}</span>
                    {artistPhone && role !== "CUSTOMER" && (
                      <span className="text-slate-400 ml-1.5 font-normal">
                        (📞{" "}
                        <a
                          href={`tel:${artistPhone}`}
                          className="text-emerald-400 hover:text-emerald-300 underline"
                          title="Call artist"
                        >
                          {artistPhone}
                        </a>
                        )
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-amber-400 font-medium">Unassigned</span>
                )}
              </p>
            )}

            {/* Delivery Agent */}
            {(role === "ADMIN" || deliveryAgentName || order.delivery_agent_id) && (
              <p>
                <strong className="text-slate-300">Delivery Agent:</strong>{" "}
                {deliveryAgentName ? (
                  <>
                    <span className="text-cyan-400 font-semibold">{deliveryAgentName}</span>
                    {deliveryAgentPhone && (
                      <span className="text-slate-400 ml-1.5 font-normal">
                        (📞{" "}
                        <a
                          href={`tel:${deliveryAgentPhone}`}
                          className="text-cyan-400 hover:text-cyan-300 underline"
                          title="Call delivery agent"
                        >
                          {deliveryAgentPhone}
                        </a>
                        )
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500 font-normal">Not assigned</span>
                )}
              </p>
            )}
          </div>

          {/* Contextual Status callouts */}
          {role === "ARTIST" && order.status === "COMPLETED" && (
            <div className="pt-1 text-xs text-amber-300 font-medium flex items-center gap-1.5">
              <span>⏳</span>
              <span>Collage Processing</span>
            </div>
          )}

          {role === "ARTIST" && ["ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "PUBLISHED"].includes(order.status) && (
            <div className="pt-1 text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <span>✓</span>
              <span>{order.is_published_to_gallery ? "Published to Gallery" : "Commission Completed"}</span>
            </div>
          )}

          {role === "ADMIN" && order.status === "ASSIGNED_ARTIST" && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 text-xs text-purple-300 font-medium">
                <span>⏳</span> Assigned to {assignedArtist?.full_name || "Artist"} (Awaiting Confirmation)
              </span>
            </div>
          )}

          {role === "ADMIN" && order.status === "ASSIGNED_DELIVERY_AGENT" && (
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 text-xs text-cyan-300 font-medium">
                <span>⏳</span> Assigned to {assignedDeliveryAgent?.full_name || "Delivery Agent"} (Awaiting Confirmation)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Actions Bar (Rendered ONLY when actionable) */}
      {hasActions && (
        <div className="flex flex-col items-stretch md:items-end justify-between gap-2 w-full md:w-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 flex-shrink-0">
          {/* ADMIN ACTIONS */}
          {role === "ADMIN" && (
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              {order.status === "PLACED" && (
                <button
                  type="button"
                  onClick={() => onAdminConfirmOrder?.(order)}
                  className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-black transition flex items-center justify-center gap-1 shadow-sm whitespace-nowrap"
                >
                  <span>✓</span> Confirm Order
                </button>
              )}

              {order.status === "CONFIRMED" && (
                <button
                  type="button"
                  onClick={() => onAdminAssignArtist?.(order)}
                  className="rounded-lg bg-brand hover:bg-brand/90 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <span>👤</span> Assign Artist
                </button>
              )}

              {order.status === "COMPLETED" && (
                <button
                  type="button"
                  onClick={() => onInspectCollage?.(order)}
                  className="rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 py-1.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  title="Inspect finished artwork & assign delivery agent"
                >
                  <span>👁️</span> Inspect Artwork
                </button>
              )}

              {order.status === "DELIVERY_FAILED" && (
                <div className="flex flex-col items-stretch md:items-end gap-1.5">
                  <div className="rounded-lg bg-rose-950/60 border border-rose-500/40 p-2 text-xs text-rose-200 text-left md:text-right max-w-xs">
                    <p className="font-semibold text-rose-300">⚠️ Attempt {order.delivery_attempts || 1}/3 Failed</p>
                    <p className="text-[11px] text-slate-300">{order.delivery_failure_reason || "Customer unavailable"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAdminAssignDelivery?.(order)}
                    className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>🚚</span> Assign Delivery Agent
                  </button>
                </div>
              )}

              {order.status === "DELIVERED" && (
                <button
                  type="button"
                  onClick={() => onAdminPublish?.(order)}
                  disabled={isPublishing}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  title="Publish artwork to public gallery"
                >
                  <span>🌟</span> {isPublishing ? "Publishing..." : "Publish to Gallery"}
                </button>
              )}
            </div>
          )}

          {/* ARTIST ACTIONS */}
          {role === "ARTIST" && (
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              {order.status === "ASSIGNED_ARTIST" && (
                <div className="flex flex-col gap-2 w-full md:w-52">
                  <button
                    type="button"
                    onClick={() => onArtistAccept?.(order)}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✓</span> Confirm & Start Drawing
                  </button>
                  <button
                    type="button"
                    onClick={() => onArtistDecline?.(order)}
                    className="w-full rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 transition flex items-center justify-center gap-1 whitespace-nowrap"
                  >
                    <span>✕</span> Decline
                  </button>
                </div>
              )}

              {order.status === "IN_PROGRESS" && (
                <button
                  type="button"
                  onClick={() => onArtistComplete?.(order)}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <span>✓</span> Complete & Upload Sketch
                </button>
              )}
            </div>
          )}

          {/* DELIVERY AGENT ACTIONS */}
          {role === "DELIVERY_AGENT" && (
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              {order.status === "ASSIGNED_DELIVERY_AGENT" && (
                <div className="flex flex-col gap-2 w-full md:w-52">
                  <button
                    type="button"
                    onClick={() => onDeliveryPickUp?.(order)}
                    className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>📦</span> Pick Up & Dispatch (In-Transit)
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeliveryDirectOut?.(order)}
                    className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>🛵</span> Direct Out for Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeliveryDecline?.(order)}
                    className="rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3 py-1.5 text-xs font-semibold text-rose-300 transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✕</span> Decline
                  </button>
                </div>
              )}

              {order.status === "IN_TRANSIT" && (
                <button
                  type="button"
                  onClick={() => onDeliveryOutToday?.(order)}
                  className="rounded-lg bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                >
                  <span>🛵</span> Out for Delivery Today
                </button>
              )}

              {order.status === "OUT_FOR_DELIVERY" && (
                <div className="flex flex-col gap-2 w-full md:w-56">
                  <button
                    type="button"
                    onClick={() => onDeliveryDelivered?.(order)}
                    className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✅</span> Confirm Handover (Delivered)
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeliveryFailed?.(order)}
                    className="w-full rounded-lg bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3 py-1.5 text-xs font-semibold text-rose-300 transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✕</span> Attempt Failed
                  </button>
                </div>
              )}

              {order.status === "DELIVERY_FAILED" && (
                <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
                  <div className="rounded-lg bg-rose-950/60 border border-rose-500/40 p-2.5 text-xs text-rose-200 text-left md:text-right max-w-xs">
                    <p className="font-semibold text-rose-300">⚠️ Attempt {order.delivery_attempts || 1}/3 Failed</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">{order.delivery_failure_reason || "Customer unavailable"}</p>
                  </div>
                  {(order.delivery_attempts || 1) < 3 ? (
                    <button
                      type="button"
                      onClick={() => onDeliveryReattempt?.(order)}
                      className="rounded-lg bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>🔁</span> Schedule Re-attempt (Attempt {(order.delivery_attempts || 1) + 1}/3)
                    </button>
                  ) : (
                    <span className="text-xs text-rose-400 font-medium text-right">
                      🛑 Max 3 attempts reached. Return parcel to logistics hub.
                    </span>
                  )}
                </div>
              )}

              {(order.status === "DELIVERED" || order.status === "PUBLISHED") && (
                <div className="flex items-center gap-1 text-xs text-emerald-400 font-semibold whitespace-nowrap">
                  <span>✓</span> Handover Verified
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER ACTIONS */}
          {role === "CUSTOMER" && (
            <div className="flex flex-col items-stretch md:items-end gap-2 w-full md:w-auto">
              {order.status === "PLACED" && (
                <div className="flex flex-col items-stretch md:items-end gap-1.5 w-full">
                  <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 text-right">
                    ⏳ Awaiting Payment
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onCustomerPay?.(order.order_id)}
                      disabled={isPaying}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>💳</span> {isPaying ? "Connecting..." : "Pay Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCustomerCancel?.(order.order_id)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium py-1 transition flex items-center justify-end gap-1"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                </div>
              )}

              {(order.status === "PUBLISHED" || order.is_published_to_gallery) && (order.final_image_url || order.collage_image_url) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onInspectCollage?.(order)}
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>👁️</span> Preview Sketch & Collage
                  </button>
                  <a
                    href={order.collage_image_url ? resolveImage(order.collage_image_url) : resolveImage(order.final_image_url)}
                    target="_blank"
                    rel="noreferrer"
                    download={`artifyme_${order.collage_image_url ? "collage" : "sketch"}_${order.order_id.slice(0, 8)}.jpg`}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition inline-flex items-center gap-1 whitespace-nowrap"
                  >
                    <span>↓</span> Download {order.collage_image_url ? "Collage" : "Artwork"}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
