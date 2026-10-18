import React from "react";
import type { Order } from "../types/order";
import { API_URL } from "../lib/api";

function resolveImage(url?: string): string {
  if (!url) return "";
  return url.startsWith("http") ? url : `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

export interface EarningsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: "ARTIST" | "DELIVERY_AGENT" | "ADMIN";
  user: {
    user_id: string;
    full_name: string;
    email?: string;
    phone_number?: string;
    address?: string;
    bio?: string;
  };
  orders: Order[];
  commissionPercentage: number;
  platformMarginPercentage: number;
  onViewPhoto?: (url: string) => void;
}

const CATEGORY_COLORS: Record<string, { color: string; label: string }> = {
  OIL: { color: "#f59e0b", label: "Oil Painting" },
  PENCIL: { color: "#3b82f6", label: "Pencil Sketch" },
  CHARCOAL: { color: "#94a3b8", label: "Charcoal" },
  WATERCOLOR: { color: "#10b981", label: "Watercolor" },
  ACRYLIC: { color: "#ec4899", label: "Acrylic Painting" },
  COLOR_PENCIL: { color: "#a855f7", label: "Colored Pencil" },
  DIGITAL: { color: "#06b6d4", label: "Digital Artwork" },
};

export const EarningsDashboardModal: React.FC<EarningsDashboardModalProps> = ({
  isOpen,
  onClose,
  role,
  user,
  orders,
  commissionPercentage,
  platformMarginPercentage,
  onViewPhoto,
}) => {
  if (!isOpen) return null;

  const commissionRate = commissionPercentage / 100;
  const platformRate = platformMarginPercentage / 100;

  // Filter completed/delivered orders
  const activeOrders = orders.filter(
    (o) => o.status === "COMPLETED" || o.status === "PUBLISHED" || o.status === "DELIVERED"
  );

  const lifetimeRevenue = activeOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  const lifetimeCommission = Math.round(lifetimeRevenue * commissionRate);
  const lifetimeStudioShare = Math.round(lifetimeRevenue * platformRate);
  const lifetimeCompletedCount = activeOrders.length;
  const avgPerCommission =
    lifetimeCompletedCount > 0 ? Math.round(lifetimeCommission / lifetimeCompletedCount) : 0;

  // Group orders by month for trend chart
  const monthlyMap = new Map<string, { label: string; commission: number; gross: number; count: number }>();
  const now = new Date();
  const monthsList: string[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthsList.push(key);
    const shortMonth = d.toLocaleDateString("en-US", { month: "short" });
    const yearStr = String(d.getFullYear()).slice(-2);
    monthlyMap.set(key, { label: `${shortMonth} '${yearStr}`, commission: 0, gross: 0, count: 0 });
  }

  for (const o of activeOrders) {
    if (o.created_at) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!monthlyMap.has(key)) {
        const shortMonth = d.toLocaleDateString("en-US", { month: "short" });
        const yearStr = String(d.getFullYear()).slice(-2);
        monthlyMap.set(key, { label: `${shortMonth} '${yearStr}`, commission: 0, gross: 0, count: 0 });
        monthsList.push(key);
      }
      const item = monthlyMap.get(key)!;
      const price = Number(o.total_price) || 0;
      item.gross += price;
      item.commission += Math.round(price * commissionRate);
      item.count += 1;
    }
  }

  monthsList.sort();
  const monthlyData = monthsList.map((key) => ({ key, ...monthlyMap.get(key)! }));
  const maxCommission = Math.max(5000, ...monthlyData.map((m) => m.commission));

  // Category breakdown
  const categoryMap: Record<string, { count: number; commission: number; color: string; label: string }> = {};
  for (const o of activeOrders) {
    const cat = (o.painting_category || "OTHER").toUpperCase();
    const info = CATEGORY_COLORS[cat] || { color: "#06b6d4", label: cat };
    if (!categoryMap[cat]) {
      categoryMap[cat] = { count: 0, commission: 0, color: info.color, label: info.label };
    }
    const price = Number(o.total_price) || 0;
    categoryMap[cat].count += 1;
    categoryMap[cat].commission += Math.round(price * commissionRate);
  }

  const categoryList = Object.entries(categoryMap).sort((a, b) => b[1].count - a[1].count);

  const isDelivery = role === "DELIVERY_AGENT";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md ${
                isDelivery
                  ? "bg-gradient-to-tr from-sky-600 via-cyan-500 to-blue-400"
                  : "bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400"
              }`}
            >
              {isDelivery ? "🚚" : user.full_name?.charAt(0)?.toUpperCase() || "A"}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isDelivery ? "🚚" : "💰"}</span>
                <span>
                  {isDelivery ? "Delivery Agent Payroll Dashboard" : "Artist Payroll Dashboard"}: {user.full_name}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {user.email || (isDelivery ? "Platform Delivery Agent" : "Verified Studio Artist")} •{" "}
                {commissionPercentage}% {isDelivery ? "Delivery Fee Tier" : "Commission Tier"} •{" "}
                {platformMarginPercentage}% Platform Margin
              </p>
              {(user.phone_number || user.address) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {user.phone_number && <span>Phone: {user.phone_number}</span>}
                  {user.phone_number && user.address && <span> • </span>}
                  {user.address && <span>Address: {user.address}</span>}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Close Dashboard"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1">
          {/* 1. KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Card 1: Payroll / Net Earnings */}
            <div
              className={`rounded-xl border p-3.5 space-y-1 shadow-sm ${
                isDelivery
                  ? "border-sky-500/30 bg-sky-950/20"
                  : "border-emerald-500/30 bg-emerald-950/20"
              }`}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${
                  isDelivery ? "text-sky-400" : "text-emerald-400"
                }`}
              >
                <span>{isDelivery ? "🚚" : "💰"}</span>
                <span>Payroll ({commissionPercentage}%)</span>
              </p>
              <p className={`text-xl font-extrabold ${isDelivery ? "text-sky-300" : "text-emerald-300"}`}>
                ₹{lifetimeCommission.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-slate-400">
                {isDelivery ? "Courier net earnings" : "Artist net earnings"}
              </p>
            </div>

            {/* Card 2: Gross Sales */}
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 space-y-1 shadow-sm">
              <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>📈</span>
                <span>Gross {isDelivery ? "Parcel Sales" : "Portrait Sales"}</span>
              </p>
              <p className="text-xl font-extrabold text-cyan-300">
                ₹{lifetimeRevenue.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-slate-400">Total client payments</p>
            </div>

            {/* Card 3: Delivered Count */}
            <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-1 shadow-sm">
              <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isDelivery ? "📦" : "🎨"}</span>
                <span>{isDelivery ? "Delivered Parcels" : "Delivered Portraits"}</span>
              </p>
              <p className="text-xl font-extrabold text-purple-300">{lifetimeCompletedCount}</p>
              <p className="text-[10px] text-slate-400">
                Avg ₹{avgPerCommission.toLocaleString("en-IN")}/{isDelivery ? "delivery" : "piece"}
              </p>
            </div>

            {/* Card 4: Studio Margin */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-1 shadow-sm">
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <span>🏛️</span>
                <span>Studio Margin ({platformMarginPercentage}%)</span>
              </p>
              <p className="text-xl font-extrabold text-amber-300">
                ₹{lifetimeStudioShare.toLocaleString("en-IN")}
              </p>
              <p className="text-[10px] text-slate-400">Platform operational fee</p>
            </div>
          </div>

          {/* 2. Graphical Monthly Earnings Trend (SVG Bar Chart) */}
          <div className="rounded-xl border border-slate-800 bg-slate-850/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>📊</span>
                  <span>
                    Monthly Earnings Progression ({commissionPercentage}% {isDelivery ? "Fee" : "Commission"})
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">Historical monthly payout trend</p>
              </div>
              <span
                className={`text-xs font-semibold rounded-lg px-2.5 py-1 ${
                  isDelivery
                    ? "text-sky-400 bg-sky-500/10 border border-sky-500/30"
                    : "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                }`}
              >
                Peak: ₹{Math.max(0, ...monthlyData.map((m) => m.commission)).toLocaleString("en-IN")}
              </span>
            </div>

            {activeOrders.length === 0 ? (
              <div className="h-44 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
                <span className="text-3xl">📊</span>
                <p className="text-xs font-medium text-slate-300">No completed orders yet</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  {isDelivery
                    ? "When this delivery agent completes doorstep handovers, monthly delivery fees will be graphed here."
                    : "When this artist completes and delivers customer portrait commissions, monthly earnings will be graphed here."}
                </p>
              </div>
            ) : (
              <div className="w-full">
                {/* SVG Bar Chart */}
                <svg viewBox="0 0 560 170" className="w-full h-44 overflow-visible">
                  <defs>
                    <linearGradient id="chartBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDelivery ? "#38bdf8" : "#10b981"} />
                      <stop offset="100%" stopColor={isDelivery ? "#6366f1" : "#06b6d4"} />
                    </linearGradient>
                    <linearGradient id="chartEmptyGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#334155" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#1e293b" stopOpacity="0.2" />
                    </linearGradient>
                  </defs>

                  {/* Y-Axis dashed grid lines */}
                  <line x1="45" y1="20" x2="540" y2="20" stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
                  <text x="40" y="24" textAnchor="end" fill="#64748b" fontSize="9" fontWeight="500">
                    ₹{Math.round(maxCommission).toLocaleString("en-IN")}
                  </text>

                  <line x1="45" y1="75" x2="540" y2="75" stroke="#334155" strokeDasharray="3 3" strokeOpacity="0.4" />
                  <text x="40" y="79" textAnchor="end" fill="#64748b" fontSize="9" fontWeight="500">
                    ₹{Math.round(maxCommission / 2).toLocaleString("en-IN")}
                  </text>

                  <line x1="45" y1="130" x2="540" y2="130" stroke="#475569" strokeWidth="1" />
                  <text x="40" y="133" textAnchor="end" fill="#64748b" fontSize="9" fontWeight="500">
                    ₹0
                  </text>

                  {/* Bars for each month */}
                  {monthlyData.map((m, idx) => {
                    const slotWidth = (540 - 45) / monthlyData.length;
                    const barWidth = Math.min(38, slotWidth * 0.65);
                    const centerX = 45 + idx * slotWidth + slotWidth / 2;
                    const barX = centerX - barWidth / 2;

                    const plotHeight = 110;
                    const calculatedHeight = (m.commission / maxCommission) * plotHeight;
                    const barHeight = m.commission > 0 ? Math.max(6, calculatedHeight) : 0;
                    const barY = 130 - barHeight;

                    return (
                      <g key={m.key} className="group cursor-pointer">
                        <rect
                          x={centerX - slotWidth / 2 + 2}
                          y="15"
                          width={slotWidth - 4}
                          height="120"
                          fill="#ffffff"
                          fillOpacity="0"
                          className="group-hover:fill-opacity-5 transition"
                          rx="6"
                        />

                        {m.commission > 0 && (
                          <text
                            x={centerX}
                            y={barY - 6}
                            textAnchor="middle"
                            fill={isDelivery ? "#38bdf8" : "#10b981"}
                            fontSize="9.5"
                            fontWeight="700"
                          >
                            ₹{m.commission.toLocaleString("en-IN")}
                          </text>
                        )}

                        {m.commission > 0 ? (
                          <rect
                            x={barX}
                            y={barY}
                            width={barWidth}
                            height={barHeight}
                            fill="url(#chartBarGradient)"
                            rx="4"
                            className="transition-all duration-300 filter drop-shadow(0 2px 4px rgba(16,185,129,0.3)) group-hover:brightness-125"
                          />
                        ) : (
                          <rect
                            x={barX}
                            y="126"
                            width={barWidth}
                            height="4"
                            fill="url(#chartEmptyGradient)"
                            rx="2"
                          />
                        )}

                        <text
                          x={centerX}
                          y="146"
                          textAnchor="middle"
                          fill={m.count > 0 ? "#cbd5e1" : "#64748b"}
                          fontSize="10"
                          fontWeight={m.count > 0 ? "600" : "400"}
                        >
                          {m.label}
                        </text>

                        {m.count > 0 && (
                          <text
                            x={centerX}
                            y={158}
                            textAnchor="middle"
                            fill="#94a3b8"
                            fontSize="8.5"
                          >
                            {m.count} {isDelivery ? "delivery" : "order"}{m.count === 1 ? "" : "s"}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* 3. Category / Medium Distribution Breakdown */}
          {categoryList.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-850/60 p-4 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>🎨</span>
                <span>{isDelivery ? "Art Medium & Delivery Distribution" : "Art Medium Distribution & Commissions"}</span>
              </h4>

              {/* Segmented Horizontal Progress Bar */}
              <div className="h-3 rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
                {categoryList.map(([cat, info]) => {
                  const pct = Math.round((info.count / lifetimeCompletedCount) * 100);
                  return (
                    <div
                      key={cat}
                      style={{ width: `${pct}%`, backgroundColor: info.color }}
                      className="h-full transition-all relative group"
                      title={`${info.label}: ${info.count} ${isDelivery ? "deliveries" : "orders"} (${pct}%)`}
                    />
                  );
                })}
              </div>

              {/* Category Legend Badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {categoryList.map(([cat, info]) => {
                  const pct = Math.round((info.count / lifetimeCompletedCount) * 100);
                  return (
                    <div
                      key={cat}
                      className="rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 flex items-center gap-2 text-xs"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: info.color }} />
                      <span className="font-semibold text-slate-200">{info.label}</span>
                      <span className="text-slate-400">({info.count} • {pct}%)</span>
                      <span className={`font-bold ml-1 ${isDelivery ? "text-sky-400" : "text-emerald-400"}`}>
                        ₹{info.commission.toLocaleString("en-IN")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Completed Commissions List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>📋</span>
                <span>
                  {isDelivery ? "Itemized Handover Deliveries" : "Itemized Completed Commissions"} ({activeOrders.length})
                </span>
              </h4>
              <span className="text-xs text-slate-400">All completed & published orders</span>
            </div>

            {activeOrders.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-xs">
                {isDelivery ? "No delivered parcels on record." : "No completed commissions on record."}
              </p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {activeOrders.map((o) => {
                  const orderPrice = Number(o.total_price) || 0;
                  const share = Math.round(orderPrice * commissionRate);
                  const studioShare = Math.round(orderPrice * platformRate);

                  return (
                    <div
                      key={o.order_id}
                      className="rounded-xl border border-slate-800 bg-slate-850/80 p-3 flex items-center justify-between gap-4 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-3">
                        {o.final_image_url || o.reference_image_url ? (
                          <img
                            src={resolveImage(o.final_image_url || o.reference_image_url)}
                            alt="Portrait"
                            onClick={() => onViewPhoto?.(resolveImage(o.final_image_url || o.reference_image_url))}
                            className="w-12 h-12 rounded-lg object-contain bg-slate-950 border border-slate-700 cursor-pointer hover:scale-105 transition"
                            title="Click to view artwork"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-400">
                            {isDelivery ? "📦" : "🎨"}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs text-white font-semibold">
                              #{o.order_id.slice(0, 8)}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                              {o.painting_category}
                            </span>
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                              {o.size} • {o.persons_included}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            {isDelivery && o.delivery_address ? (
                              <span>📍 {o.delivery_address} • </span>
                            ) : null}
                            Completed:{" "}
                            {o.created_at
                              ? new Date(o.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Recent"}
                          </p>
                        </div>
                      </div>

                      {/* Financial Share */}
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">Order: ₹{orderPrice.toLocaleString("en-IN")}</p>
                        <p className={`text-sm font-bold ${isDelivery ? "text-sky-300" : "text-emerald-300"}`}>
                          +₹{share.toLocaleString("en-IN")}{" "}
                          <span
                            className={`text-[10px] font-normal ${
                              isDelivery ? "text-sky-400" : "text-emerald-400"
                            }`}
                          >
                            ({commissionPercentage}%)
                          </span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          Studio: ₹{studioShare.toLocaleString("en-IN")} ({platformMarginPercentage}%)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Lifetime Earnings:{" "}
            <strong className={isDelivery ? "text-sky-300" : "text-emerald-300"}>
              ₹{lifetimeCommission.toLocaleString("en-IN")}
            </strong>{" "}
            across {lifetimeCompletedCount} completed {isDelivery ? "delivery" : "commission"}
            {lifetimeCompletedCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
