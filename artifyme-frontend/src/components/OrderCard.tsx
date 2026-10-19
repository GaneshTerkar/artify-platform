import React from "react";
import type { Order, VerifiedArtist, ActiveDeliveryAgent, PlatformUser } from "../types/order";
import { CollageThumbnail } from "./CollageThumbnail";
import { API_URL } from "../lib/api";

function resolveImage(url?: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function getCarrierTrackingUrl(carrier?: string, trackingNumber?: string): string {
  if (!trackingNumber) return "#";
  const norm = (carrier || "").toLowerCase();
  const enc = encodeURIComponent(trackingNumber.trim());
  if (norm.includes("blue dart") || norm.includes("bluedart")) {
    return `https://www.bluedart.com/tracking?trackNumber=${enc}`;
  }
  if (norm.includes("delhivery")) {
    return `https://www.delhivery.com/track/package/${enc}`;
  }
  if (norm.includes("dtdc")) {
    return `https://www.dtdc.in/tracking/shipment-tracking.asp?strCnno=${enc}`;
  }
  return `https://track.courier.com/${enc}`;
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

export function getOrderMilestoneStep(status: string): number {
  switch (status) {
    case "PLACED":
      return 1;
    case "CONFIRMED":
      return 2;
    case "ASSIGNED_ARTIST":
      return 2;
    case "IN_PROGRESS":
    case "COMPLETED":
      return 3;
    case "ASSIGNED_DELIVERY_AGENT":
    case "IN_TRANSIT":
    case "OUT_FOR_DELIVERY":
    case "DELIVERY_FAILED":
      return 4;
    case "DELIVERED":
    case "PUBLISHED":
      return 5;
    default:
      return 0;
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
  onAdminUpdateLogistics?: (order: Order) => void;
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
  onCustomerLeaveReview?: (order: Order) => void;
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
  onAdminUpdateLogistics,
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
  onCustomerLeaveReview,
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
    (role === "ADMIN" && order.status !== "CANCELLED") ||
    (role === "ARTIST" && (order.status === "ASSIGNED_ARTIST" || order.status === "IN_PROGRESS")) ||
    (role === "DELIVERY_AGENT" && ["ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERY_FAILED"].includes(order.status)) ||
    (role === "CUSTOMER" && (order.status === "PLACED" || ["COMPLETED", "DELIVERED", "PUBLISHED"].includes(order.status) || ((order.status === "PUBLISHED" || order.is_published_to_gallery) && Boolean(order.final_image_url || order.collage_image_url))));

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-slate-900/70 p-5 shadow-lg hover:border-slate-700/80 transition-all flex flex-col gap-4">
      {/* 1. TOP HEADER: Status, Category, Size, Order ID, Price */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800/80 pb-3">
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
                : order.status.replaceAll("_", " ")}
            </span>
          )}
          <span className="rounded-md bg-slate-800 border border-slate-700/70 px-2 py-0.5 text-xs font-medium text-slate-300">
            {order.painting_category}
          </span>
          <span className="rounded-md bg-slate-800 border border-slate-700/70 px-2 py-0.5 text-xs font-medium text-slate-300">
            {order.size} • {order.persons_included}
          </span>
          <span className="font-mono text-xs text-slate-500">
            #{order.order_id.slice(0, 8)}
          </span>
        </div>

        {/* Price & Role Compensation */}
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <p className="text-lg font-bold text-white tracking-tight">
            ₹{Number(order.total_price).toLocaleString("en-IN")}
          </p>
          {role === "ARTIST" && commissionSplit && (
            <span className="text-xs text-purple-300 bg-purple-950/70 border border-purple-500/30 rounded-md px-2 py-0.5 font-medium">
              Payout: ₹{Math.round(Number(order.total_price) * (commissionSplit.artistPercentage / 100)).toLocaleString("en-IN")} ({commissionSplit.artistPercentage}%)
            </span>
          )}
          {role === "DELIVERY_AGENT" && commissionSplit && (
            <span className="text-xs text-cyan-300 bg-cyan-950/70 border border-cyan-500/30 rounded-md px-2 py-0.5 font-medium">
              Delivery Fee: ₹{(Number(order.total_price) * (commissionSplit.deliveryPercentage / 100)).toFixed(2)} ({commissionSplit.deliveryPercentage}%)
            </span>
          )}
        </div>
      </div>

      {/* 2. MAIN SECTION: Thumbnail on Left + Structured 2-Column Info on Right */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Left: Thumbnail Preview */}
        <div className="flex-shrink-0">
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
        </div>

        {/* Right: Balanced 2-Column Details Grid */}
        <div className="flex-1 w-full space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {/* Column 1: Customer & Delivery Address */}
            <div className="space-y-2">
              {(customerName || customerPhone) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 w-4 text-center">👤</span>
                  <span className="text-slate-400 font-medium">Customer:</span>
                  <span className="text-white font-semibold">{customerName || "Customer"}</span>
                  {customerPhone && (
                    <a
                      href={`tel:${customerPhone}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded-md px-1.5 py-0.5 transition"
                      title="Call customer"
                    >
                      <span>📞</span>
                      <span>{customerPhone}</span>
                    </a>
                  )}
                </div>
              )}

              {order.delivery_address && (
                <div className="flex items-start gap-2">
                  <span className="text-slate-500 w-4 text-center pt-0.5">📍</span>
                  <div className="flex-1">
                    <span className="text-slate-400 font-medium">Address: </span>
                    <span className="text-slate-200">{order.delivery_address}</span>
                    {role === "DELIVERY_AGENT" && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.delivery_address)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300 text-[11px] underline"
                        title="Open in Google Maps"
                      >
                        🗺️ Map
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Assigned Artist & Delivery Agent */}
            <div className="space-y-2">
              {(role === "ADMIN" || role === "CUSTOMER" || role === "DELIVERY_AGENT" || (role === "ARTIST" && (artistName || order.artist_id))) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 w-4 text-center">🎨</span>
                  <span className="text-slate-400 font-medium">Artist:</span>
                  {artistName ? (
                    <>
                      <span className="text-emerald-400 font-semibold">{artistName}</span>
                      {role === "ADMIN" && order.artist_id && (
                        <span className="text-[10px] text-slate-500 ml-1">(assigned)</span>
                      )}
                      {artistPhone && role !== "CUSTOMER" && (
                        <a
                          href={`tel:${artistPhone}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 rounded-md px-1.5 py-0.5 transition"
                          title="Call artist"
                        >
                          <span>📞</span>
                          <span>{artistPhone}</span>
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-amber-400 font-medium">Unassigned</span>
                  )}
                </div>
              )}

              {(role === "ADMIN" || deliveryAgentName || order.delivery_agent_id) && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 w-4 text-center">🚚</span>
                  <span className="text-slate-400 font-medium">Delivery:</span>
                  {deliveryAgentName ? (
                    <>
                      <span className="text-cyan-400 font-semibold">{deliveryAgentName}</span>
                      {deliveryAgentPhone && (
                        <a
                          href={`tel:${deliveryAgentPhone}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 rounded-md px-1.5 py-0.5 transition"
                          title="Call delivery agent"
                        >
                          <span>📞</span>
                          <span>{deliveryAgentPhone}</span>
                        </a>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-500 font-normal">Not assigned</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Customer Notes */}
          {order.customer_notes && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-950/60 border border-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300">
              <span className="text-slate-500">💬</span>
              <span className="text-slate-400 font-medium">Notes:</span>
              <span className="italic text-slate-300">"{order.customer_notes}"</span>
            </div>
          )}

          {/* Logistics & Carrier Tracking */}
          {order.tracking_number && (
            <div className="flex items-center gap-2 flex-wrap text-xs bg-indigo-950/40 border border-indigo-500/30 rounded-xl px-3 py-2 mt-1">
              <span className="text-indigo-300 font-semibold flex items-center gap-1.5">
                <span>🚀</span>
                <span>{order.courier_partner || "Courier"}:</span>
              </span>
              <span className="font-mono text-white font-bold">{order.tracking_number}</span>
              <a
                href={getCarrierTrackingUrl(order.courier_partner, order.tracking_number)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-white bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-400/40 rounded-md px-2 py-0.5 transition shadow-sm ml-1"
                title="Open live shipment tracking portal"
              >
                <span>Live Tracking</span>
                <span>↗</span>
              </a>
              {order.estimated_delivery_at && (
                <span className="text-slate-400 text-[11px] ml-auto">
                  Est: {new Date(order.estimated_delivery_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* Admin Dispatch Notes */}
          {order.admin_dispatch_notes && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-950/30 border border-amber-500/30 px-2.5 py-1.5 text-xs text-amber-200 mt-1">
              <span className="text-amber-400">📦</span>
              <span className="font-medium text-amber-300">Dispatch:</span>
              <span className="italic">{order.admin_dispatch_notes}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 VISUAL PROGRESS STEPPER (When not cancelled) */}
      {order.status !== "CANCELLED" && (
        <div className="rounded-xl bg-slate-950/40 border border-slate-800/60 px-4 py-3">
          <div className="flex items-center justify-between relative">
            {/* Background connecting bar */}
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-0.5 bg-slate-800 -z-0" />

            {[
              { step: 1, label: "Placed & Paid", icon: "✓" },
              { step: 2, label: "Artist Assigned", icon: "🎨" },
              { step: 3, label: "Painting Studio", icon: "🖌️" },
              { step: 4, label: "Out for Delivery", icon: "🚚" },
              { step: 5, label: "Delivered", icon: "🌟" },
            ].map((m) => {
              const currentStep = getOrderMilestoneStep(order.status);
              const isPast = m.step < currentStep;
              const isCurrent = m.step === currentStep;

              return (
                <div key={m.step} className="flex flex-col items-center gap-1.5 relative z-10">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-sm ${
                      isPast
                        ? "bg-emerald-500 text-black border-2 border-emerald-400"
                        : isCurrent
                        ? "bg-brand text-white border-2 border-brand-light ring-4 ring-brand/20 animate-pulse"
                        : "bg-slate-900 text-slate-500 border border-slate-700"
                    }`}
                  >
                    {isPast ? "✓" : m.icon}
                  </div>
                  <span
                    className={`text-[10px] font-medium hidden sm:inline whitespace-nowrap ${
                      isCurrent
                        ? "text-brand-light font-bold"
                        : isPast
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  >
                    {m.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FOOTER ROW: Contextual Status on Left, Actions on Right */}
      <div className="border-t border-slate-800/80 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Left: Role-specific Contextual Status or Order Date */}
        <div className="text-xs">
          {/* CUSTOMER CONTEXTUAL STATUS */}
          {role === "CUSTOMER" && (
            <div className="flex flex-col gap-0.5">
              {order.status === "PLACED" && (
                <span className="text-amber-300 font-medium flex items-center gap-1.5">
                  <span>⏳</span> Awaiting payment — Complete checkout to start canvas painting
                </span>
              )}
              {order.status === "CONFIRMED" && (
                <span className="text-amber-300 font-medium flex items-center gap-1.5">
                  <span>✓</span> Payment confirmed — Curator is assigning a verified master artist
                </span>
              )}
              {order.status === "ASSIGNED_ARTIST" && (
                <span className="text-purple-300 font-medium flex items-center gap-1.5">
                  <span>🎨</span> Master painter assigned ({artistName || "Studio Artist"}) — Preparing canvas
                </span>
              )}
              {order.status === "IN_PROGRESS" && (
                <span className="text-blue-300 font-medium flex items-center gap-1.5">
                  <span>🖌️</span> Active fine-art hand-painting in progress by {artistName || "your artist"}
                </span>
              )}
              {order.status === "COMPLETED" && (
                <span className="text-amber-300 font-medium flex items-center gap-1.5">
                  <span>✨</span> Portrait finished — Undergoing quality inspection & collage framing
                </span>
              )}
              {order.status === "ASSIGNED_DELIVERY_AGENT" && (
                <span className="text-cyan-300 font-medium flex items-center gap-1.5">
                  <span>📦</span> Museum-grade packaged — Assigned to doorstep delivery courier
                </span>
              )}
              {order.status === "IN_TRANSIT" && (
                <span className="text-indigo-300 font-medium flex items-center gap-1.5">
                  <span>🚚</span> In transit — Dispatched from studio hub to your city
                </span>
              )}
              {order.status === "OUT_FOR_DELIVERY" && (
                <span className="text-sky-300 font-medium flex items-center gap-1.5">
                  <span>🛵</span> Out for delivery today — Courier is en route to your address
                </span>
              )}
              {order.status === "DELIVERED" && (
                <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                  <span>✅</span> Handover complete — Masterpiece delivered safely to your doorstep!
                </span>
              )}
              {order.status === "PUBLISHED" && (
                <span className="text-emerald-300 font-medium flex items-center gap-1.5">
                  <span>🌟</span> Delivered & published to public art gallery showcase!
                </span>
              )}
              {order.status === "DELIVERY_FAILED" && (
                <span className="text-rose-400 font-medium flex items-center gap-1.5">
                  <span>⚠️</span> Delivery attempt unsuccessful — Courier will reattempt delivery shortly
                </span>
              )}
              {order.status === "CANCELLED" && (
                <span className="text-rose-400 font-medium flex items-center gap-1.5">
                  <span>✕</span> Order cancelled
                </span>
              )}
              {order.created_at && (
                <span className="text-slate-500 text-[10px]">
                  Order Placed: {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* ARTIST CONTEXTUAL STATUS */}
          {role === "ARTIST" && (
            <div className="flex flex-col gap-0.5">
              {order.status === "COMPLETED" && (
                <span className="text-amber-300 font-medium flex items-center gap-1.5">
                  <span>⏳</span> Collage processing in background & awaiting courier dispatch
                </span>
              )}
              {["ASSIGNED_DELIVERY_AGENT", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "PUBLISHED"].includes(order.status) && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span>✓</span> {order.is_published_to_gallery ? "Published to Studio Gallery" : "Commission Completed & Handed Over"}
                </span>
              )}
              {order.created_at && (
                <span className="text-slate-500 text-[10px]">
                  Assigned Date: {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* ADMIN CONTEXTUAL STATUS */}
          {role === "ADMIN" && (
            <div className="flex flex-col gap-0.5">
              {order.status === "ASSIGNED_ARTIST" && (
                <span className="inline-flex items-center gap-1.5 text-purple-300 font-medium">
                  <span>⏳</span> Assigned to {assignedArtist?.full_name || "Artist"} (Awaiting Confirmation)
                </span>
              )}
              {order.status === "ASSIGNED_DELIVERY_AGENT" && (
                <span className="inline-flex items-center gap-1.5 text-cyan-300 font-medium">
                  <span>⏳</span> Assigned to {assignedDeliveryAgent?.full_name || "Delivery Agent"} (Awaiting Confirmation)
                </span>
              )}
              {order.created_at && (
                <span className="text-slate-500 text-[10px]">
                  Created: {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}

          {/* DELIVERY AGENT CONTEXTUAL STATUS */}
          {role === "DELIVERY_AGENT" && (
            <div className="flex flex-col gap-0.5">
              {(order.status === "DELIVERED" || order.status === "PUBLISHED") && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span>✓</span> Handover Verified
                </span>
              )}
              {order.created_at && (
                <span className="text-slate-500 text-[10px]">
                  Assigned: {new Date(order.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions */}
        {hasActions && (
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {/* ADMIN ACTIONS */}
            {role === "ADMIN" && (
              <>
                {order.status === "PLACED" && (
                  <button
                    type="button"
                    onClick={() => onAdminConfirmOrder?.(order)}
                    className="rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-2 text-xs font-bold text-black transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✓</span> Confirm Order
                  </button>
                )}

                {order.status === "CONFIRMED" && (
                  <button
                    type="button"
                    onClick={() => onAdminAssignArtist?.(order)}
                    className="rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>👤</span> Assign Artist
                  </button>
                )}

                {order.status === "COMPLETED" && (
                  <button
                    type="button"
                    onClick={() => onInspectCollage?.(order)}
                    className="rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    title="Inspect finished artwork & assign delivery agent"
                  >
                    <span>👁️</span> Inspect Artwork
                  </button>
                )}

                {order.status === "DELIVERY_FAILED" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAdminAssignDelivery?.(order)}
                      className="rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
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
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    title="Publish artwork to public gallery"
                  >
                    <span>🌟</span> {isPublishing ? "Publishing..." : "Publish to Gallery"}
                  </button>
                )}

                {order.status !== "PLACED" && (
                  <button
                    type="button"
                    onClick={() => onAdminUpdateLogistics?.(order)}
                    className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    title="Update courier partner, tracking number, and dispatch notes"
                  >
                    <span>📦</span> Logistics / AWB
                  </button>
                )}
              </>
            )}

            {/* ARTIST ACTIONS */}
            {role === "ARTIST" && (
              <>
                {order.status === "ASSIGNED_ARTIST" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onArtistAccept?.(order)}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>✓</span> Confirm & Start Drawing
                    </button>
                    <button
                      type="button"
                      onClick={() => onArtistDecline?.(order)}
                      className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-rose-300 transition flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>✕</span> Decline
                    </button>
                  </div>
                )}

                {order.status === "IN_PROGRESS" && (
                  <button
                    type="button"
                    onClick={() => onArtistComplete?.(order)}
                    className="rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>✓</span> Complete & Upload Sketch
                  </button>
                )}
              </>
            )}

            {/* DELIVERY AGENT ACTIONS */}
            {role === "DELIVERY_AGENT" && (
              <>
                {order.status === "ASSIGNED_DELIVERY_AGENT" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDeliveryPickUp?.(order)}
                      className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>📦</span> Pick Up Parcel
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeliveryDirectOut?.(order)}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-3.5 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>🛵</span> Direct Out for Delivery
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeliveryDecline?.(order)}
                      className="rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3 py-2 text-xs font-medium text-rose-300 transition flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>✕</span> Decline
                    </button>
                  </div>
                )}

                {order.status === "IN_TRANSIT" && (
                  <button
                    type="button"
                    onClick={() => onDeliveryOutToday?.(order)}
                    className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  >
                    <span>🛵</span> Out for Delivery Today
                  </button>
                )}

                {order.status === "OUT_FOR_DELIVERY" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDeliveryDelivered?.(order)}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>✅</span> Confirm Handover (Delivered)
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeliveryFailed?.(order)}
                      className="rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 px-3.5 py-2 text-xs font-medium text-rose-300 transition flex items-center gap-1 whitespace-nowrap"
                    >
                      <span>✕</span> Attempt Failed
                    </button>
                  </div>
                )}

                {order.status === "DELIVERY_FAILED" && (
                  (order.delivery_attempts || 1) < 3 ? (
                    <button
                      type="button"
                      onClick={() => onDeliveryReattempt?.(order)}
                      className="rounded-xl bg-sky-600 hover:bg-sky-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>🔁</span> Reattempt Delivery ({(order.delivery_attempts || 1) + 1}/3)
                    </button>
                  ) : (
                    <span className="text-xs text-rose-400 font-medium">
                      🛑 Return parcel to hub
                    </span>
                  )
                )}
              </>
            )}

            {/* CUSTOMER ACTIONS */}
            {role === "CUSTOMER" && (
              <>
                {order.status === "PLACED" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1">
                      ⏳ Awaiting Payment
                    </span>
                    <button
                      type="button"
                      onClick={() => onCustomerPay?.(order.order_id)}
                      disabled={isPaying}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                    >
                      <span>💳</span> {isPaying ? "Connecting..." : "Pay Now"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCustomerCancel?.(order.order_id)}
                      className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2 py-1 transition flex items-center gap-1"
                    >
                      ✕ Cancel
                    </button>
                  </div>
                )}

                {(order.status === "PUBLISHED" || order.is_published_to_gallery) && (order.final_image_url || order.collage_image_url) && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectCollage?.(order)}
                      className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-2 text-xs font-bold text-white transition inline-flex items-center gap-1.5 shadow-md shadow-emerald-950/40 whitespace-nowrap"
                    >
                      <span>👁️</span> Preview Sketch & Collage
                    </button>
                    <a
                      href={order.collage_image_url ? resolveImage(order.collage_image_url) : resolveImage(order.final_image_url)}
                      target="_blank"
                      rel="noreferrer"
                      download={`artifyme_${order.collage_image_url ? "collage" : "sketch"}_${order.order_id.slice(0, 8)}.jpg`}
                      className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <span>↓</span> Download {order.collage_image_url ? "Collage" : "Artwork"}
                    </a>
                  </div>
                )}

                {["COMPLETED", "DELIVERED", "PUBLISHED"].includes(order.status) && (
                  <button
                    type="button"
                    onClick={() => onCustomerLeaveReview?.(order)}
                    className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 px-3.5 py-2 text-xs font-bold text-slate-950 transition flex items-center gap-1.5 shadow-md shadow-amber-950/40 whitespace-nowrap"
                    title="Leave or view your verified review"
                  >
                    <span>⭐</span> Review Artwork
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

