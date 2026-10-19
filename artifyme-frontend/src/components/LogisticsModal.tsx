import React, { useState, useEffect } from "react";
import type { Order } from "../types/order";
import { api } from "../lib/api";

interface LogisticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: (updatedOrder: Order) => void;
}

export const LogisticsModal: React.FC<LogisticsModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const [courierPartner, setCourierPartner] = useState("");
  const [customCourier, setCustomCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [adminDispatchNotes, setAdminDispatchNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const presetCouriers = ["Blue Dart", "Delhivery", "DTDC", "In-House Courier", "Other"];

  useEffect(() => {
    if (order) {
      const currentCourier = order.courier_partner || "";
      if (presetCouriers.slice(0, 4).includes(currentCourier)) {
        setCourierPartner(currentCourier);
        setCustomCourier("");
      } else if (currentCourier) {
        setCourierPartner("Other");
        setCustomCourier(currentCourier);
      } else {
        setCourierPartner("Blue Dart");
        setCustomCourier("");
      }

      setTrackingNumber(order.tracking_number || "");
      if (order.estimated_delivery_at) {
        try {
          const d = new Date(order.estimated_delivery_at);
          setEstimatedDeliveryAt(d.toISOString().split("T")[0]);
        } catch {
          setEstimatedDeliveryAt("");
        }
      } else {
        setEstimatedDeliveryAt("");
      }
      setAdminDispatchNotes(order.admin_dispatch_notes || "");
      setError("");
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    const resolvedCourier = courierPartner === "Other" ? customCourier.trim() : courierPartner;
    const resolvedEst = estimatedDeliveryAt ? new Date(estimatedDeliveryAt).toISOString() : null;

    try {
      const res = await api<{ message: string; order: Order }>(
        `/api/v1/admin/orders/${order.order_id}/logistics`,
        {
          method: "PATCH",
          body: JSON.stringify({
            courier_partner: resolvedCourier || null,
            tracking_number: trackingNumber.trim() || null,
            estimated_delivery_at: resolvedEst,
            admin_dispatch_notes: adminDispatchNotes.trim() || null,
          }),
        }
      );
      onSuccess(res.order);
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to update logistics");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <div>
              <h2 className="text-base font-bold text-white">Logistics & Live Tracking</h2>
              <p className="text-xs text-slate-400">Order #{order.order_id.slice(0, 8)}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Courier Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Courier / Carrier Partner
            </label>
            <select
              value={courierPartner}
              onChange={(e) => setCourierPartner(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            >
              {presetCouriers.map((cp) => (
                <option key={cp} value={cp}>
                  {cp}
                </option>
              ))}
            </select>
          </div>

          {courierPartner === "Other" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Custom Courier Name
              </label>
              <input
                type="text"
                placeholder="e.g. FedEx, Speed Post, Express"
                value={customCourier}
                onChange={(e) => setCustomCourier(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {/* Tracking Number / AWB */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tracking Number / AWB Code
            </label>
            <input
              type="text"
              placeholder="e.g. BD123456789IN or DEL98765432"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-cyan-500"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              A clickable carrier tracking link will be generated automatically for the buyer.
            </p>
          </div>

          {/* Estimated Delivery Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Estimated Delivery Date
            </label>
            <input
              type="date"
              value={estimatedDeliveryAt}
              onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Admin Dispatch / Remediation Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Dispatch & Remediation Notes
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Dispatched in weather-proof cylindrical tube with protective corner guards. Handed over to Blue Dart Express hub."
              value={adminDispatchNotes}
              onChange={(e) => setAdminDispatchNotes(e.target.value)}
              className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 px-5 py-2 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-lg shadow-cyan-950/50"
            >
              <span>💾</span>
              <span>{isSubmitting ? "Saving..." : "Update Logistics"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
