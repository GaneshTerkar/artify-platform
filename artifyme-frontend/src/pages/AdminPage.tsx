import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Order, VerifiedArtist, ArtistReviewItem, PlatformUser } from "../types/order";
import { CollageThumbnail } from "../components/CollageThumbnail";
import { CollageArtworkModal } from "../components/CollageArtworkModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface PolicyThresholds {
  minArtistCompletedOrders: number;
  maxArtistStalledAssignments: number;
  maxCustomerCancelledOrders: number;
  maxCustomerUnconfirmedPlaced: number;
  maxArtistCancelledCommissions: number;
  maxArtistStalledForRisk: number;
}

export const DEFAULT_POLICY_THRESHOLDS: PolicyThresholds = {
  minArtistCompletedOrders: 2,
  maxArtistStalledAssignments: 0,
  maxCustomerCancelledOrders: 2,
  maxCustomerUnconfirmedPlaced: 2,
  maxArtistCancelledCommissions: 2,
  maxArtistStalledForRisk: 1,
};

export interface WarningEntry {
  warningNumber: number;
  reason: string;
  message: string;
  timestamp: string;
}

export interface UserWarningRecord {
  count: number;
  history: WarningEntry[];
}

export type UserWarningsMap = Record<string, UserWarningRecord>;

export function FacebookVerifiedBadge({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={`${className} text-[#1877F2] flex-shrink-0 inline-block`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2.25c.34 0 .67.08.98.24l1.8 1c.4.22.87.3 1.33.22l2.02-.34c.64-.11 1.28.16 1.66.69.38.53.44 1.22.16 1.8l-.89 1.86c-.2.42-.23.9-.08 1.34l.65 1.94c.21.62.03 1.3-.46 1.73l-1.57 1.33c-.35.3-.56.73-.59 1.19l-.16 2.04c-.05.65-.46 1.21-1.06 1.44-.6.23-1.27.08-1.73-.39l-1.44-1.47a1.88 1.88 0 0 0-1.32-.54c-.48 0-.94.2-1.32.54l-1.44 1.47c-.46.47-1.13.62-1.73.39-.6-.23-1.01-.79-1.06-1.44l-.16-2.04c-.03-.46-.24-.89-.59-1.19l-1.57-1.33c-.49-.43-.67-1.11-.46-1.73l.65-1.94c.15-.44.12-.92-.08-1.34l-.89-1.86c-.28-.58-.22-1.27.16-1.8.38-.53 1.02-.8 1.66-.69l2.02.34c.46.08.93 0 1.33-.22l1.8-1c.31-.16.64-.24.98-.24z" />
      <path fill="#ffffff" d="M10.2 15.5l-3.2-3.2 1.4-1.4 1.8 1.8 4.8-4.8 1.4 1.4-6.2 6.2z" />
    </svg>
  );
}

export function getUserOrderMetrics(
  u: PlatformUser,
  allOrders: Order[],
  thresholds: PolicyThresholds = DEFAULT_POLICY_THRESHOLDS
) {
  const isArtist = u.role === "ARTIST";
  const isCustomer = u.role === "CUSTOMER";

  const orders = allOrders.filter((o) =>
    isArtist ? o.artist_id === u.user_id : o.user_id === u.user_id
  );

  const completed = orders.filter((o) => o.status === "COMPLETED" || o.status === "PUBLISHED").length;
  const cancelled = orders.filter((o) => o.status === "CANCELLED").length;
  // For artists: assigned to artist but awaiting start (stalled); for customers: placed but not confirmed
  const unconfirmed = isArtist
    ? orders.filter((o) => o.status === "ASSIGNED_ARTIST").length
    : orders.filter((o) => o.status === "PLACED").length;

  const inProgress = isArtist
    ? orders.filter((o) => o.status === "IN_PROGRESS").length
    : orders.filter((o) => o.status === "CONFIRMED" || o.status === "ASSIGNED_ARTIST" || o.status === "IN_PROGRESS").length;

  // Customer At-Risk: cancelled >= maxCustomerCancelledOrders, or (unconfirmed >= maxCustomerUnconfirmedPlaced and completed === 0)
  const isCustomerAtRisk = isCustomer && (
    cancelled >= thresholds.maxCustomerCancelledOrders ||
    (unconfirmed >= thresholds.maxCustomerUnconfirmedPlaced && completed === 0)
  );

  // Artist At-Risk: unconfirmed >= maxArtistStalledForRisk or cancelled >= maxArtistCancelledCommissions
  const isArtistAtRisk = isArtist && (
    unconfirmed >= thresholds.maxArtistStalledForRisk ||
    cancelled >= thresholds.maxArtistCancelledCommissions
  );

  const isAtRisk = isCustomerAtRisk || isArtistAtRisk;

  // Artist Admin Qualification: verified artist, ACTIVE, completed >= minArtistCompletedOrders, unconfirmed <= maxArtistStalledAssignments
  const isAdminEligible = isArtist &&
    u.is_verified_artist &&
    u.status === "ACTIVE" &&
    completed >= thresholds.minArtistCompletedOrders &&
    unconfirmed <= thresholds.maxArtistStalledAssignments;

  const isGoodStanding = completed > 0 && cancelled === 0 && unconfirmed === 0;

  return {
    total: orders.length,
    completed,
    cancelled,
    unconfirmed,
    inProgress,
    isAtRisk,
    isCustomerAtRisk,
    isArtistAtRisk,
    isAdminEligible,
    isGoodStanding,
  };
}

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const ARTIST_COMMISSION_PERCENTAGE = 0.40;
  const PLATFORM_MARGIN_PERCENTAGE = 0.60;

  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: "orders" | "users" | "payroll" =
    tabParam === "users" ? "users" : tabParam === "payroll" ? "payroll" : "orders";

  const handleTabChange = (tab: "orders" | "users" | "payroll") => {
    setSearchParams({ tab });
  };

  // Policy Thresholds configurable state (persisted to localStorage)
  const [policyThresholds, setPolicyThresholds] = useState<PolicyThresholds>(() => {
    try {
      const saved = localStorage.getItem("artifyme_policy_thresholds");
      if (saved) return { ...DEFAULT_POLICY_THRESHOLDS, ...JSON.parse(saved) };
    } catch {
      // fallback
    }
    return DEFAULT_POLICY_THRESHOLDS;
  });

  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [tempPolicy, setTempPolicy] = useState<PolicyThresholds>(policyThresholds);

  // Payroll states
  const [payrollMonth, setPayrollMonth] = useState<string>("ALL");
  const [selectedArtistBreakdown, setSelectedArtistBreakdown] = useState<{
    artist_id: string;
    full_name: string;
    email?: string;
    bio?: string;
  } | null>(null);

  // Progressive warning system (3 notices required before suspension)
  const [userWarnings, setUserWarnings] = useState<UserWarningsMap>(() => {
    try {
      const saved = localStorage.getItem("artifyme_user_warnings");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  function saveUserWarnings(updated: UserWarningsMap) {
    setUserWarnings(updated);
    try {
      localStorage.setItem("artifyme_user_warnings", JSON.stringify(updated));
    } catch {
      // fallback
    }
  }

  const [warningUser, setWarningUser] = useState<{
    user: PlatformUser;
    currentCount: number;
    defaultReason: string;
    defaultMessage: string;
  } | null>(null);
  const [warningReason, setWarningReason] = useState<string>("");
  const [warningMessage, setWarningMessage] = useState<string>("");

  // User management modal states
  const [elevatingArtist, setElevatingArtist] = useState<PlatformUser | null>(null);
  const [suspendingUser, setSuspendingUser] = useState<{ user: PlatformUser; targetStatus: "ACTIVE" | "SUSPENDED" } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string>("Frequent unconfirmed or cancelled orders");
  const [userSubFilter, setUserSubFilter] = useState<"ALL" | "VERIFIED" | "PENDING_REVIEW" | "AT_RISK" | "ADMIN_ELIGIBLE">("ALL");
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

  const userRiskCounts = useMemo(() => {
    let atRisk = 0;
    let adminEligible = 0;
    for (const u of allUsers) {
      if (userRoleFilter === "CUSTOMER" && u.role !== "CUSTOMER") continue;
      if (userRoleFilter === "ARTIST" && u.role !== "ARTIST") continue;
      if (userRoleFilter === "ADMIN" && u.role !== "ADMIN") continue;

      const m = getUserOrderMetrics(u, allOrders, policyThresholds);
      if (m.isAtRisk) atRisk++;
      if (m.isAdminEligible) adminEligible++;
    }
    return { atRisk, adminEligible };
  }, [allUsers, allOrders, policyThresholds, userRoleFilter]);

  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (userRoleFilter === "CUSTOMER" && u.role !== "CUSTOMER") return false;
      if (userRoleFilter === "ADMIN" && u.role !== "ADMIN") return false;
      if (userRoleFilter === "ARTIST" && u.role !== "ARTIST") return false;

      const metrics = getUserOrderMetrics(u, allOrders, policyThresholds);
      if (userSubFilter === "VERIFIED" && !u.is_verified_artist) return false;
      if (userSubFilter === "PENDING_REVIEW" && u.is_verified_artist) return false;
      if (userSubFilter === "AT_RISK" && !metrics.isAtRisk) return false;
      if (userSubFilter === "ADMIN_ELIGIBLE" && !metrics.isAdminEligible) return false;

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
  }, [allUsers, allOrders, userRoleFilter, userSubFilter, userSearchQuery, policyThresholds]);

  // Payroll calculations (40% Artist / 60% Studio)
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const o of allOrders) {
      if ((o.status === "COMPLETED" || o.status === "PUBLISHED") && o.created_at) {
        const d = new Date(o.created_at);
        const yyyyMm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.add(yyyyMm);
      }
    }
    return Array.from(months).sort().reverse();
  }, [allOrders]);

  const payrollCompletedOrders = useMemo(() => {
    return allOrders.filter((o) => {
      const isDone = o.status === "COMPLETED" || o.status === "PUBLISHED";
      if (!isDone) return false;
      if (payrollMonth !== "ALL") {
        const d = new Date(o.created_at);
        const yyyyMm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (yyyyMm !== payrollMonth) return false;
      }
      return true;
    });
  }, [allOrders, payrollMonth]);

  const totalGrossRevenue = useMemo(() => {
    return payrollCompletedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
  }, [payrollCompletedOrders]);
  const totalArtistCommissions = Math.round(totalGrossRevenue * ARTIST_COMMISSION_PERCENTAGE);
  const totalPlatformMargin = Math.round(totalGrossRevenue * PLATFORM_MARGIN_PERCENTAGE);

  const artistPayrollList = useMemo(() => {
    return verifiedArtists.map((artist) => {
      const orders = payrollCompletedOrders.filter((o) => o.artist_id === artist.artist_id);
      const completedCount = orders.length;
      const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
      const artistCommission = Math.round(totalRevenue * ARTIST_COMMISSION_PERCENTAGE);
      const platformMargin = Math.round(totalRevenue * PLATFORM_MARGIN_PERCENTAGE);

      return {
        artist,
        completedCount,
        totalRevenue,
        artistCommission,
        platformMargin,
        orders,
      };
    });
  }, [verifiedArtists, payrollCompletedOrders, ARTIST_COMMISSION_PERCENTAGE, PLATFORM_MARGIN_PERCENTAGE]);

  function exportUsersToCSV(users: PlatformUser[]) {
    const headers = [
      "User ID",
      "Full Name",
      "Username",
      "Email",
      "Phone",
      "Address",
      "Role",
      "Status",
      "Verified Artist",
      "Orders Placed",
      "Commissions Completed",
      "Joined Date",
    ];

    const rows = users.map((u) => [
      `"${u.user_id}"`,
      `"${(u.full_name || "").replace(/"/g, '""')}"`,
      `"${(u.user_name || "").replace(/"/g, '""')}"`,
      `"${(u.email || "").replace(/"/g, '""')}"`,
      `"${(u.phone_number || "").replace(/"/g, '""')}"`,
      `"${(u.address || "").replace(/"/g, '""')}"`,
      `"${u.role}"`,
      `"${u.status}"`,
      `"${u.is_verified_artist ? "Yes" : "No"}"`,
      u.orders_count || 0,
      u.assigned_orders_count || 0,
      `"${u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `artifyme_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

  const updateUserStatusMutation = useMutation({
    mutationFn: ({ userId, status, reason }: { userId: string; status: "ACTIVE" | "SUSPENDED"; reason?: string }) =>
      api(`/api/v1/admin/users/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, reason }),
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      setSuspendingUser(null);
      if (vars.status === "ACTIVE") {
        const updated = { ...userWarnings };
        delete updated[vars.userId];
        saveUserWarnings(updated);
      }
      showMessage(
        vars.status === "SUSPENDED"
          ? `Account suspended successfully${vars.reason ? ` (${vars.reason})` : ""}.`
          : "Account reactivated successfully. Warning history reset."
      );
    },
    onError: (err: Error) => showMessage(err.message, "error"),
  });

  const elevateArtistMutation = useMutation({
    mutationFn: (userId: string) =>
      api(`/api/v1/admin/users/${userId}/role`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      setElevatingArtist(null);
      showMessage("Artist promoted to Admin successfully!");
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

          <button
            type="button"
            onClick={() => handleTabChange("payroll")}
            className={`rounded-xl px-5 py-2.5 text-center transition border cursor-pointer ${
              activeTab === "payroll"
                ? "bg-slate-800 border-brand shadow-lg ring-1 ring-brand/50"
                : "bg-slate-800/80 border-slate-700 hover:border-slate-500 hover:bg-slate-800"
            }`}
          >
            <p className={`text-xs uppercase tracking-wider font-semibold ${
              activeTab === "payroll" ? "text-brand" : "text-amber-400"
            }`}>
              Payroll Due (40%)
            </p>
            <p className="text-xl font-bold text-amber-300">₹{totalArtistCommissions.toLocaleString("en-IN")}</p>
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
        <button
          onClick={() => handleTabChange("payroll")}
          className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 ${
            activeTab === "payroll"
              ? "border-brand text-brand font-semibold"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          <span>💰 Payroll Due</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
            ₹{totalArtistCommissions.toLocaleString("en-IN")}
          </span>
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
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-3.5 space-y-2.5">
            {/* ROW 1: Role Filter Pills (Left) + Search & Export (Right) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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
                        setUserSubFilter("ALL");
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition ${
                        isActive
                          ? "bg-slate-700 text-white font-semibold border border-slate-500 shadow-sm"
                          : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-transparent"
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

              {/* Right Side: Quick Search, Policy Thresholds & Export CSV */}
              <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
                <div className="relative min-w-[180px] max-w-xs flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="rounded-lg bg-slate-800 border border-slate-700 pl-7 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand w-full"
                  />
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setTempPolicy(policyThresholds);
                    setIsPolicyModalOpen(true);
                  }}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5 shadow-sm whitespace-nowrap"
                  title="Adjust policy thresholds for account risk and admin elevation"
                >
                  <span>⚙️</span>
                  <span>Policy Thresholds</span>
                </button>

                <button
                  type="button"
                  onClick={() => exportUsersToCSV(filteredUsers)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition flex items-center gap-1 shadow-sm whitespace-nowrap"
                  title="Export current user list to CSV for Excel"
                >
                  <span>📥</span> <span className="hidden sm:inline">Export</span> CSV
                </button>

                <span className="text-slate-400 text-xs whitespace-nowrap hidden lg:inline">
                  <strong className="text-white">{filteredUsers.length}</strong>/{allUsers.length}
                </span>
              </div>
            </div>

            {/* ROW 2: Contextual Sub-filters (Hidden for ADMINS) */}
            {userRoleFilter !== "ADMIN" && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2.5 border-t border-slate-800/60 text-xs">
                <div className="flex items-center gap-1.5 mr-1">
                  <span className="text-slate-500 font-medium text-[11px] uppercase tracking-wider">
                    Filter:
                  </span>
                  {userSubFilter !== "ALL" && (
                    <button
                      type="button"
                      onClick={() => setUserSubFilter("ALL")}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition flex items-center gap-1 shadow-sm"
                      title="Clear active filter"
                    >
                      <span>✕</span>
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {/* 1. Verified (Artists only) */}
                {userRoleFilter === "ARTIST" && (
                  <button
                    type="button"
                    onClick={() => setUserSubFilter(userSubFilter === "VERIFIED" ? "ALL" : "VERIFIED")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      userSubFilter === "VERIFIED"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold shadow-sm"
                        : "bg-slate-800/90 text-slate-400 hover:text-emerald-300 border border-transparent"
                    }`}
                  >
                    <span>✓ Verified</span>
                    <span className="rounded-full bg-emerald-500/30 text-emerald-200 px-1.5 py-0.2 text-[10px] font-bold">
                      {userCounts.VERIFIED_ARTIST}
                    </span>
                  </button>
                )}

                {/* 2. Pending Review (Artists only) */}
                {userRoleFilter === "ARTIST" && (
                  <button
                    type="button"
                    onClick={() => setUserSubFilter(userSubFilter === "PENDING_REVIEW" ? "ALL" : "PENDING_REVIEW")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      userSubFilter === "PENDING_REVIEW"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                        : "bg-slate-800/90 text-slate-400 hover:text-amber-300 border border-transparent"
                    }`}
                  >
                    <span>⏳ Pending Review</span>
                    <span className="rounded-full bg-amber-500/30 text-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                      {userCounts.PENDING_REVIEW}
                    </span>
                  </button>
                )}

                {/* 3. At-Risk / Needs Attention */}
                <button
                  type="button"
                  onClick={() => setUserSubFilter(userSubFilter === "AT_RISK" ? "ALL" : "AT_RISK")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                    userSubFilter === "AT_RISK"
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold shadow-sm"
                      : "bg-slate-800/90 text-slate-400 hover:text-rose-300 border border-transparent"
                  }`}
                  title={
                    userRoleFilter === "CUSTOMER"
                      ? "Show customers with excessive cancellations or unconfirmed placed orders"
                      : userRoleFilter === "ARTIST"
                      ? "Show artists with stalled assignments or cancellations"
                      : "Show accounts flagged as at-risk"
                  }
                >
                  <span>⚠️</span>
                  <span>
                    {userRoleFilter === "CUSTOMER"
                      ? "At-Risk Customers"
                      : userRoleFilter === "ARTIST"
                      ? "Needs Attention"
                      : "Needs Attention"}
                  </span>
                  <span className="rounded-full bg-rose-500/30 text-rose-200 px-1.5 py-0.2 text-[10px] font-bold">
                    {userRiskCounts.atRisk}
                  </span>
                </button>

                {/* 4. Admin-Eligible (Artists or All only - Hidden for Customers) */}
                {userRoleFilter !== "CUSTOMER" && (
                  <button
                    type="button"
                    onClick={() => setUserSubFilter(userSubFilter === "ADMIN_ELIGIBLE" ? "ALL" : "ADMIN_ELIGIBLE")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      userSubFilter === "ADMIN_ELIGIBLE"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm"
                        : "bg-slate-800/90 text-slate-400 hover:text-amber-300 border border-transparent"
                    }`}
                    title={`Show verified artists with at least ${policyThresholds.minArtistCompletedOrders} completed commissions and 0 stalled assignments`}
                  >
                    <span>⭐</span>
                    <span>Admin-Eligible</span>
                    <span className="rounded-full bg-amber-500/30 text-amber-200 px-1.5 py-0.2 text-[10px] font-bold">
                      {userRiskCounts.adminEligible}
                    </span>
                  </button>
                )}
              </div>
            )}
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
                  setUserSubFilter("ALL");
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
                const isCustomer = u.role === "CUSTOMER";
                const isPendingArtist = isArtist && !u.is_verified_artist;
                const metrics = getUserOrderMetrics(u, allOrders, policyThresholds);
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1 mr-1">
                            <h3 className="text-base font-bold text-white">{u.full_name}</h3>
                            {/* Facebook-style verified badge for verified artists */}
                            {isArtist && u.is_verified_artist && (
                              <span
                                title="Verified Artist: Portfolio approved and verified by Admin"
                                className="inline-flex items-center cursor-help transition-transform hover:scale-125 ml-0.5"
                              >
                                <FacebookVerifiedBadge className="w-4.5 h-4.5" />
                              </span>
                            )}
                          </div>

                          {/* Role Symbol Badge */}
                          <span
                            title={
                              u.role === "ADMIN"
                                ? "Role: Administrator"
                                : isArtist
                                ? "Role: Artist"
                                : "Role: Customer"
                            }
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs shadow-sm cursor-help transition-transform hover:scale-110 ${
                              u.role === "ADMIN"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : isArtist
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                            }`}
                          >
                            {u.role === "ADMIN" ? "👑" : isArtist ? "🎨" : "👤"}
                          </span>

                          {/* Account Status Symbol Badge */}
                          <span
                            title={
                              u.status === "ACTIVE"
                                ? "Account Status: Active"
                                : u.status === "PENDING"
                                ? "Account Status: Pending Approval"
                                : "Account Status: Suspended"
                            }
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs shadow-sm cursor-help transition-transform hover:scale-110 ${
                              u.status === "ACTIVE"
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : u.status === "PENDING"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                            }`}
                          >
                            {u.status === "ACTIVE" ? "🟢" : u.status === "PENDING" ? "🟡" : "🔴"}
                          </span>

                          {/* Artist Pending Review Status Badge (if not verified yet) */}
                          {isArtist && !u.is_verified_artist && (
                            <span
                              title="Pending Review: Artist application awaiting verification"
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full border text-xs shadow-sm cursor-help transition-transform hover:scale-110 bg-amber-500/20 text-amber-300 border-amber-500/40"
                            >
                              ⏳
                            </span>
                          )}

                          {/* Risk Badges (Symbol-only with hover tooltip) */}
                          {metrics.isCustomerAtRisk && (
                            <span
                              title={`At-Risk Customer: ${metrics.cancelled} cancelled, ${metrics.unconfirmed} unconfirmed order(s)`}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs shadow-sm cursor-help transition-transform hover:scale-110"
                            >
                              ⚠️
                            </span>
                          )}

                          {metrics.isArtistAtRisk && (
                            <span
                              title={`Needs Attention: ${metrics.unconfirmed > 0 ? `${metrics.unconfirmed} stalled commission(s)` : `${metrics.cancelled} cancelled commission(s)`}`}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs shadow-sm cursor-help transition-transform hover:scale-110"
                            >
                              ⚠️
                            </span>
                          )}

                          {/* Admin-Eligibility Badge (Symbol-only with hover tooltip) */}
                          {metrics.isAdminEligible && (
                            <span
                              title={`Admin-Eligible: Verified artist with ${metrics.completed} completed commissions and 0 stalled assignments`}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/40 text-xs shadow-sm cursor-help transition-transform hover:scale-110"
                            >
                              ⭐
                            </span>
                          )}

                          {/* Good Standing Badge (Symbol-only with hover tooltip) */}
                          {metrics.isGoodStanding && (
                            <span
                              title="Good Standing: Completed commissions with zero cancellations and zero stalled assignments"
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold cursor-help transition-transform hover:scale-110"
                            >
                              ✓
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
                          {isCustomer && (
                            <p className="text-blue-300 font-medium pt-0.5 flex flex-wrap items-center gap-x-2">
                              <span>📦 {u.orders_count} portrait order{u.orders_count === 1 ? "" : "s"} placed</span>
                              {metrics.completed > 0 && <span className="text-emerald-400 font-semibold">• {metrics.completed} completed</span>}
                              {metrics.cancelled > 0 && <span className="text-rose-400 font-semibold">• {metrics.cancelled} cancelled</span>}
                              {metrics.unconfirmed > 0 && <span className="text-amber-400 font-semibold">• {metrics.unconfirmed} unconfirmed</span>}
                            </p>
                          )}

                          {isArtist && (
                            <div className="space-y-0.5 pt-0.5">
                              <p className="text-purple-300 font-medium flex flex-wrap items-center gap-x-2">
                                <span>🎨 {u.assigned_orders_count} commission{u.assigned_orders_count === 1 ? "" : "s"} assigned</span>
                                <span>• {u.experience_years} year{u.experience_years === 1 ? "" : "s"} exp</span>
                                {metrics.unconfirmed > 0 && (
                                  <span className="text-amber-400 font-semibold">• ⚠️ {metrics.unconfirmed} unconfirmed / stalled</span>
                                )}
                              </p>
                              {(() => {
                                const artistCompletedOrders = allOrders.filter(
                                  (o) => o.artist_id === u.user_id && (o.status === "COMPLETED" || o.status === "PUBLISHED")
                                );
                                const totalEarned = Math.round(
                                  artistCompletedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0) *
                                    ARTIST_COMMISSION_PERCENTAGE
                                );
                                return (
                                  <p className="text-emerald-400 font-semibold text-xs pt-0.5 flex items-center gap-1.5">
                                    <span>💰</span> 40% Commission: ₹{totalEarned.toLocaleString("en-IN")} ({artistCompletedOrders.length} completed)
                                  </p>
                                );
                              })()}
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

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-800 flex-shrink-0">
                      {isPendingArtist ? (
                        <>
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
                        </>
                      ) : (
                        <>
                          {/* 1. View Payroll for Verified Artists (Symbol-only with hover tooltip) */}
                          {isArtist && u.is_verified_artist && (u.status === "ACTIVE" || u.status === "SUSPENDED") && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedArtistBreakdown({
                                  artist_id: u.user_id,
                                  full_name: u.full_name,
                                  email: u.email,
                                  bio: u.bio,
                                })
                              }
                              className="w-8 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 transition flex items-center justify-center text-sm shadow-sm hover:scale-110"
                              title="View Payroll: Monthly earnings, commission breakdown & performance graph"
                            >
                              💰
                            </button>
                          )}

                          {/* 2. Promote to Admin (Shown ONLY when the artist meets all criteria: Verified, Active, completed >= minCompleted, 0 stalled) */}
                          {isArtist &&
                            u.role === "ARTIST" &&
                            u.is_verified_artist &&
                            u.status === "ACTIVE" &&
                            u.user_id !== user?.user_id &&
                            metrics.isAdminEligible && (
                              <button
                                type="button"
                                onClick={() => setElevatingArtist(u)}
                                className="w-8 h-8 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 transition flex items-center justify-center text-sm shadow-sm hover:scale-110"
                                title={`Promote to Admin: Qualified with ${metrics.completed} completed commission(s) and 0 stalled assignments`}
                              >
                                ⭐
                              </button>
                            )}

                          {/* 3. Progressive Warning (🔔) or Suspension (⛔) for At-Risk Users, and Reactivation (✓) for Suspended Users */}
                          {u.user_id !== user?.user_id &&
                            u.role !== "ADMIN" &&
                            (!isArtist || u.is_verified_artist) && (
                              <>
                                {/* Active & At-Risk: Show progressive warning (🔔) or Suspend (⛔) after 3 warnings */}
                                {u.status === "ACTIVE" && metrics.isAtRisk && (
                                  (() => {
                                    const warnCount = userWarnings[u.user_id]?.count || 0;
                                    const reason = isArtist
                                      ? metrics.unconfirmed > 0
                                        ? `Stalled assignments: ${metrics.unconfirmed} commission(s) assigned but not started`
                                        : `Commission cancellations: ${metrics.cancelled} commission(s) cancelled`
                                      : metrics.cancelled >= policyThresholds.maxCustomerCancelledOrders
                                      ? `Excessive order cancellations: ${metrics.cancelled} cancelled order(s)`
                                      : `Unconfirmed orders: ${metrics.unconfirmed} order(s) placed without confirmation`;

                                    if (warnCount < 3) {
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const nextNum = warnCount + 1;
                                            const defaultMsg = nextNum === 1
                                              ? `Policy Notice (1/3): We noticed an issue with your account activity regarding "${reason}". Please review your orders to maintain good standing on ArtifyMe.`
                                              : nextNum === 2
                                              ? `Urgent Notice (2/3): This is your second warning regarding "${reason}". Continued unresponsiveness or cancellations may result in account suspension.`
                                              : `Final Notice (3/3): This is your third and final warning regarding "${reason}". If this continues, your account will be immediately suspended by platform administration.`;

                                            setWarningReason(reason);
                                            setWarningMessage(defaultMsg);
                                            setWarningUser({
                                              user: u,
                                              currentCount: warnCount,
                                              defaultReason: reason,
                                              defaultMessage: defaultMsg,
                                            });
                                          }}
                                          className="h-8 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 transition flex items-center justify-center gap-1 text-xs font-semibold shadow-sm hover:scale-105"
                                          title={`Send Policy Warning (${warnCount}/3 issued): User is at risk. 3 warnings required before suspension is authorized.`}
                                        >
                                          <span>🔔</span>
                                          <span className="text-[10px] font-bold bg-amber-500/30 px-1 py-0.2 rounded-full">
                                            {warnCount}/3
                                          </span>
                                        </button>
                                      );
                                    } else {
                                      // 3 warnings already issued and user is still at risk -> Suspend is unlocked!
                                      return (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSuspendingUser({
                                              user: u,
                                              targetStatus: "SUSPENDED",
                                            });
                                            setSuspensionReason(reason);
                                          }}
                                          className="w-8 h-8 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/80 text-rose-200 ring-1 ring-rose-500/40 transition flex items-center justify-center text-sm shadow-sm hover:scale-110"
                                          title={`Suspend Account (3 of 3 warnings issued): User remains at risk for "${reason}".`}
                                        >
                                          ⛔
                                        </button>
                                      );
                                    }
                                  })()
                                )}

                                {/* If Suspended: Show Reactivate button */}
                                {u.status === "SUSPENDED" && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSuspendingUser({
                                        user: u,
                                        targetStatus: "ACTIVE",
                                      });
                                    }}
                                    className="w-8 h-8 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 transition flex items-center justify-center text-sm shadow-sm hover:scale-110"
                                    title="Reactivate Account: Restore full login, orders, and assignment capabilities"
                                  >
                                    ✓
                                  </button>
                                )}
                              </>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYROLL & COMMISSIONS */}
      {activeTab === "payroll" && (
        <div className="space-y-6">
          {/* Top Payroll Filter & Policy Card */}
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>💰</span> Commissions & Monthly Payroll
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated monthly salary calculation based on completed and published portrait orders.
                </p>
              </div>

              {/* Month Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Billing Period:</span>
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(e.target.value)}
                  className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand font-medium"
                >
                  <option value="ALL">All Time (All Completed)</option>
                  {availableMonths.map((m) => {
                    const [year, month] = m.split("-");
                    const dateObj = new Date(Number(year), Number(month) - 1, 1);
                    const label = dateObj.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                    return (
                      <option key={m} value={m}>
                        {label} ({m})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Commission Policy Pill Banner */}
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="text-amber-400 text-sm">💡</span>
                <span>
                  <strong>Commission Rule:</strong> Verified Artists earn <strong>40%</strong> of the order price as monthly salary; ArtifyMe retains <strong>60%</strong> platform margin.
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                  Artist Share: 40%
                </span>
                <span className="text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-2.5 py-1">
                  Platform Margin: 60%
                </span>
              </div>
            </div>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 shadow">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Completed Portraits</p>
              <p className="text-2xl font-bold text-white">{payrollCompletedOrders.length}</p>
              <p className="text-[11px] text-slate-500">Orders completed / published</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-1 shadow">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Gross Portrait Sales</p>
              <p className="text-2xl font-bold text-white">₹{totalGrossRevenue.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-slate-500">Total customer revenue</p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1 shadow">
              <p className="text-xs text-emerald-400 font-medium uppercase tracking-wider">Artist Salary Due (40%)</p>
              <p className="text-2xl font-bold text-emerald-300">₹{totalArtistCommissions.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-emerald-500/80">Total payout to artists</p>
            </div>

            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-1 shadow">
              <p className="text-xs text-cyan-400 font-medium uppercase tracking-wider">Platform Margin (60%)</p>
              <p className="text-2xl font-bold text-cyan-300">₹{totalPlatformMargin.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-cyan-500/80">ArtifyMe retained revenue</p>
            </div>
          </div>

          {/* Per-Artist Breakdown Table */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🎨</span> Payroll Roster ({artistPayrollList.length})
              </h3>
              <span className="text-xs text-slate-400">
                Period: <strong className="text-white">{payrollMonth === "ALL" ? "All Time" : payrollMonth}</strong>
              </span>
            </div>

            {artistPayrollList.length === 0 ? (
              <p className="text-center py-12 text-slate-400 text-xs">No verified artists found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/70 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Artist</th>
                      <th className="py-3 px-4 text-center">Completed Work</th>
                      <th className="py-3 px-4 text-right">Order Sales (100%)</th>
                      <th className="py-3 px-4 text-right text-emerald-300 font-bold">Artist Salary (40%)</th>
                      <th className="py-3 px-4 text-right text-cyan-300">Studio Share (60%)</th>
                      <th className="py-3 px-4 text-center">Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {artistPayrollList.map(({ artist, completedCount, totalRevenue, artistCommission, platformMargin }) => (
                      <tr key={artist.artist_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold flex items-center justify-center text-xs">
                              {artist.full_name ? artist.full_name[0].toUpperCase() : "A"}
                            </div>
                            <div>
                              <p className="font-semibold text-white">{artist.full_name}</p>
                              <p className="text-[11px] text-slate-400">{artist.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              completedCount > 0
                                ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {completedCount} portrait{completedCount === 1 ? "" : "s"}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-300">
                          ₹{totalRevenue.toLocaleString("en-IN")}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-sm text-emerald-300">
                            ₹{artistCommission.toLocaleString("en-IN")}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-cyan-300/80">
                          ₹{platformMargin.toLocaleString("en-IN")}
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedArtistBreakdown(artist)}
                            disabled={completedCount === 0}
                            className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                              completedCount > 0
                                ? "bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer"
                                : "bg-slate-800/40 text-slate-600 border border-transparent cursor-not-allowed"
                            }`}
                          >
                            💰 View Payroll ({completedCount})
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
      {/* MODAL: ARTIST GRAPHICAL PAYROLL & COMMISSIONS DASHBOARD */}
      {selectedArtistBreakdown && (() => {
        // All completed orders for this artist across all time
        const artistAllOrders = allOrders.filter(
          (o) => o.artist_id === selectedArtistBreakdown.artist_id && (o.status === "COMPLETED" || o.status === "PUBLISHED")
        );

        // Lifetime KPI calculations
        const lifetimeRevenue = artistAllOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
        const lifetimeCommission = Math.round(lifetimeRevenue * ARTIST_COMMISSION_PERCENTAGE);
        const lifetimeStudioShare = Math.round(lifetimeRevenue * PLATFORM_MARGIN_PERCENTAGE);
        const lifetimeCompletedCount = artistAllOrders.length;
        const avgPerCommission = lifetimeCompletedCount > 0 ? Math.round(lifetimeCommission / lifetimeCompletedCount) : 0;

        // Group orders by month for trend chart
        const monthlyMap = new Map<string, { label: string; commission: number; gross: number; count: number }>();

        // Generate trailing 6 months window
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

        // Aggregate actual orders into monthly map
        for (const o of artistAllOrders) {
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
            item.commission += Math.round(price * ARTIST_COMMISSION_PERCENTAGE);
            item.count += 1;
          }
        }

        monthsList.sort();
        const monthlyData = monthsList.map((key) => ({ key, ...monthlyMap.get(key)! }));

        // Max commission for chart scaling (minimum 5000 to maintain nice vertical proportions)
        const maxCommission = Math.max(5000, ...monthlyData.map((m) => m.commission));

        // Category breakdown
        const categoryMap: Record<string, { count: number; commission: number; color: string; label: string }> = {};
        const CATEGORY_COLORS: Record<string, { color: string; label: string }> = {
          OIL: { color: "#f59e0b", label: "Oil Painting" },
          PENCIL: { color: "#3b82f6", label: "Pencil Sketch" },
          CHARCOAL: { color: "#94a3b8", label: "Charcoal" },
          WATERCOLOR: { color: "#10b981", label: "Watercolor" },
          COLOR_PENCIL: { color: "#ec4899", label: "Colored Pencil" },
          DIGITAL: { color: "#8b5cf6", label: "Digital Artwork" },
        };

        for (const o of artistAllOrders) {
          const cat = (o.painting_category || "OTHER").toUpperCase();
          const info = CATEGORY_COLORS[cat] || { color: "#06b6d4", label: cat };
          if (!categoryMap[cat]) {
            categoryMap[cat] = { count: 0, commission: 0, color: info.color, label: info.label };
          }
          const price = Number(o.total_price) || 0;
          categoryMap[cat].count += 1;
          categoryMap[cat].commission += Math.round(price * ARTIST_COMMISSION_PERCENTAGE);
        }

        const categoryList = Object.entries(categoryMap).sort((a, b) => b[1].count - a[1].count);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
            <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center text-white font-bold text-base shadow-md">
                    {selectedArtistBreakdown.full_name?.charAt(0)?.toUpperCase() || "A"}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>💰</span> Artist Payroll Dashboard: {selectedArtistBreakdown.full_name}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {selectedArtistBreakdown.email || "Verified Studio Artist"} • 40% Commission Tier • 60% Platform Margin
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedArtistBreakdown(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Close Payroll Dashboard"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="p-5 overflow-y-auto space-y-6 flex-1">
                {/* 1. KPI Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-1 shadow-sm">
                    <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>💰</span> Payroll Due (40%)
                    </p>
                    <p className="text-xl font-extrabold text-emerald-300">
                      ₹{lifetimeCommission.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-slate-400">Artist net earnings</p>
                  </div>

                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 space-y-1 shadow-sm">
                    <p className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>📈</span> Gross Portrait Sales
                    </p>
                    <p className="text-xl font-extrabold text-cyan-300">
                      ₹{lifetimeRevenue.toLocaleString("en-IN")}
                    </p>
                    <p className="text-[10px] text-slate-400">Total client payments</p>
                  </div>

                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-3.5 space-y-1 shadow-sm">
                    <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎨</span> Delivered Portraits
                    </p>
                    <p className="text-xl font-extrabold text-purple-300">
                      {lifetimeCompletedCount}
                    </p>
                    <p className="text-[10px] text-slate-400">Avg ₹{avgPerCommission.toLocaleString("en-IN")}/piece</p>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 space-y-1 shadow-sm">
                    <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🏢</span> Studio Margin (60%)
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
                        <span>📊</span> Monthly Earnings Progression (40% Commission)
                      </h4>
                      <p className="text-[11px] text-slate-400">Historical monthly payout trend</p>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-2.5 py-1">
                      Peak: ₹{Math.max(0, ...monthlyData.map((m) => m.commission)).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {artistAllOrders.length === 0 ? (
                    <div className="h-44 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center p-6 text-center space-y-2">
                      <span className="text-3xl">📊</span>
                      <p className="text-xs font-medium text-slate-300">No completed commissions yet</p>
                      <p className="text-[11px] text-slate-500 max-w-sm">
                        When this artist completes and delivers customer portrait commissions, monthly earnings and volume will be graphed here.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full">
                      {/* SVG Bar Chart */}
                      <svg viewBox="0 0 560 170" className="w-full h-44 overflow-visible">
                        <defs>
                          <linearGradient id="artistBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                          <linearGradient id="emptyBarGradient" x1="0" y1="0" x2="0" y2="1">
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

                          const plotHeight = 110; // from y=20 to y=130
                          const calculatedHeight = (m.commission / maxCommission) * plotHeight;
                          const barHeight = m.commission > 0 ? Math.max(6, calculatedHeight) : 0;
                          const barY = 130 - barHeight;

                          return (
                            <g key={m.key} className="group cursor-pointer">
                              {/* Background hover pillar */}
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

                              {/* Value Label above bar */}
                              {m.commission > 0 && (
                                <text
                                  x={centerX}
                                  y={barY - 6}
                                  textAnchor="middle"
                                  fill="#10b981"
                                  fontSize="9.5"
                                  fontWeight="700"
                                >
                                  ₹{m.commission.toLocaleString("en-IN")}
                                </text>
                              )}

                              {/* Active Bar */}
                              {m.commission > 0 ? (
                                <rect
                                  x={barX}
                                  y={barY}
                                  width={barWidth}
                                  height={barHeight}
                                  fill="url(#artistBarGradient)"
                                  rx="4"
                                  className="transition-all duration-300 filter drop-shadow(0 2px 4px rgba(16,185,129,0.3)) group-hover:brightness-125"
                                />
                              ) : (
                                <rect
                                  x={barX}
                                  y="126"
                                  width={barWidth}
                                  height="4"
                                  fill="url(#emptyBarGradient)"
                                  rx="2"
                                />
                              )}

                              {/* Month X-axis Label */}
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

                              {/* Orders Count Sub-label */}
                              {m.count > 0 && (
                                <text
                                  x={centerX}
                                  y={158}
                                  textAnchor="middle"
                                  fill="#94a3b8"
                                  fontSize="8.5"
                                >
                                  {m.count} order{m.count === 1 ? "" : "s"}
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
                      <span>🎨</span> Art Medium Distribution & Commissions
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
                            title={`${info.label}: ${info.count} orders (${pct}%)`}
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
                            <span className="font-bold text-emerald-400 ml-1">₹{info.commission.toLocaleString("en-IN")}</span>
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
                      <span>📋</span> Itemized Completed Commissions ({artistAllOrders.length})
                    </h4>
                    <span className="text-xs text-slate-400">All completed & published orders</span>
                  </div>

                  {artistAllOrders.length === 0 ? (
                    <p className="text-center py-6 text-slate-500 text-xs">No completed commissions on record.</p>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {artistAllOrders.map((o) => {
                        const orderPrice = Number(o.total_price) || 0;
                        const artistShare = Math.round(orderPrice * ARTIST_COMMISSION_PERCENTAGE);
                        const platformShare = Math.round(orderPrice * PLATFORM_MARGIN_PERCENTAGE);

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
                                  onClick={() => setSelectedPhoto(resolveImage(o.final_image_url || o.reference_image_url))}
                                  className="w-12 h-12 rounded-lg object-cover border border-slate-700 cursor-pointer hover:scale-105 transition"
                                  title="Click to view artwork"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs text-slate-400">
                                  🎨
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs text-white font-semibold">#{o.order_id.slice(0, 8)}</span>
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                    {o.painting_category}
                                  </span>
                                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                                    {o.size} • {o.persons_included}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                  Completed: {o.created_at ? new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recent"}
                                </p>
                              </div>
                            </div>

                            {/* Financial Share */}
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-slate-400">Order: ₹{orderPrice.toLocaleString("en-IN")}</p>
                              <p className="text-sm font-bold text-emerald-300">
                                +₹{artistShare.toLocaleString("en-IN")}{" "}
                                <span className="text-[10px] font-normal text-emerald-400">(40%)</span>
                              </p>
                              <p className="text-[10px] text-slate-500">Studio: ₹{platformShare.toLocaleString("en-IN")} (60%)</p>
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
                  Lifetime Earnings: <strong className="text-emerald-300">₹{lifetimeCommission.toLocaleString("en-IN")}</strong> across {lifetimeCompletedCount} completed commission{lifetimeCompletedCount === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedArtistBreakdown(null)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 text-xs font-semibold text-white transition"
                >
                  Close Dashboard
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: PROMOTE ARTIST TO ADMIN */}
      {elevatingArtist && (() => {
        const m = getUserOrderMetrics(elevatingArtist, allOrders, policyThresholds);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>⭐</span> Promote Artist to Admin
              </h3>
              <p className="text-xs text-slate-300">
                Are you sure you want to promote <strong>{elevatingArtist.full_name}</strong> ({elevatingArtist.email}) to <strong>Admin</strong>?
              </p>

              {/* Qualification criteria review */}
              <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span>✓</span> Admin Qualification Verified:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    • Completed Commissions: <strong className="text-emerald-300">{m.completed}</strong> (min. {policyThresholds.minArtistCompletedOrders} required)
                  </div>
                  <div>
                    • Stalled / Unconfirmed: <strong className="text-emerald-300">{m.unconfirmed}</strong> (max. {policyThresholds.maxArtistStalledAssignments} allowed)
                  </div>
                  <div>
                    • Experience: <strong className="text-white">{elevatingArtist.experience_years} years</strong>
                  </div>
                  <div>
                    • Account Status: <strong className="text-emerald-300">ACTIVE & Verified</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">⚠️ Privileges Granted:</p>
                <p>• Access to all platform orders, assignments, and gallery approvals.</p>
                <p>• Ability to review and verify new artist applications.</p>
                <p>• Access to payroll and platform users.</p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setElevatingArtist(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => elevateArtistMutation.mutate(elevatingArtist.user_id)}
                  disabled={elevateArtistMutation.isPending}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5"
                >
                  <span>⭐</span> {elevateArtistMutation.isPending ? "Promoting..." : "Confirm Promotion"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: ISSUE POLICY WARNING */}
      {warningUser && (() => {
        const nextNum = warningUser.currentCount + 1;
        const userRec = userWarnings[warningUser.user.user_id];
        const priorHistory = userRec?.history || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
            <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🔔</span>
                  <div>
                    <h3 className="text-base font-bold text-white">
                      Issue Policy Warning ({nextNum} of 3)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Formal notification to {warningUser.user.full_name} ({warningUser.user.email})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWarningUser(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              {/* 3-Step Warning Progress Bar */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div
                  className={`p-2 rounded-lg border font-semibold ${
                    nextNum === 1
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30"
                      : nextNum > 1
                      ? "bg-slate-800 text-emerald-400 border-slate-700"
                      : "bg-slate-800/40 text-slate-500 border-slate-800"
                  }`}
                >
                  <span>{nextNum > 1 ? "✓ " : "1. "}First Notice</span>
                </div>
                <div
                  className={`p-2 rounded-lg border font-semibold ${
                    nextNum === 2
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 ring-1 ring-amber-500/30"
                      : nextNum > 2
                      ? "bg-slate-800 text-emerald-400 border-slate-700"
                      : "bg-slate-800/40 text-slate-500 border-slate-800"
                  }`}
                >
                  <span>{nextNum > 2 ? "✓ " : "2. "}Second Notice</span>
                </div>
                <div
                  className={`p-2 rounded-lg border font-semibold ${
                    nextNum === 3
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30"
                      : "bg-slate-800/40 text-slate-500 border-slate-800"
                  }`}
                >
                  <span>3. Final Notice</span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                This account is currently flagged as at-risk. Policy requires <strong>3 formal warnings</strong> before the account can be suspended by administration.
                {nextNum === 3 ? (
                  <span className="block mt-1 font-semibold text-rose-300">
                    ⚠️ This is the 3rd and final notice. Account suspension will be authorized if unaddressed.
                  </span>
                ) : (
                  <span className="block mt-1 text-slate-400">
                    After this notice, {3 - nextNum} more warning{3 - nextNum === 1 ? "" : "s"} must be issued before suspension is unlocked.
                  </span>
                )}
              </p>

              {/* At-Risk Reason */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-200">
                  Identified Risk Reason:
                </label>
                <input
                  type="text"
                  value={warningReason}
                  onChange={(e) => setWarningReason(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-medium"
                  placeholder="e.g. Excessive order cancellations or stalled commissions"
                />
              </div>

              {/* Notice Message */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-semibold text-slate-200">
                  Notice Message to User:
                </label>
                <textarea
                  rows={3}
                  value={warningMessage}
                  onChange={(e) => setWarningMessage(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Prior Warning History (if any) */}
              {priorHistory.length > 0 && (
                <div className="rounded-xl bg-slate-800/60 border border-slate-700/80 p-3 space-y-1.5 text-xs">
                  <p className="font-semibold text-slate-300 flex items-center gap-1">
                    <span>📋</span> Prior Warnings Issued:
                  </p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {priorHistory.map((h, idx) => (
                      <div key={idx} className="bg-slate-900/60 rounded p-1.5 text-[11px] text-slate-300 border border-slate-800">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="font-bold text-amber-300">Notice {h.warningNumber} of 3</span>
                          <span>{new Date(h.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="mt-0.5 text-slate-200">{h.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setWarningUser(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const currentRec = userWarnings[warningUser.user.user_id] || { count: 0, history: [] };
                    const newCount = currentRec.count + 1;
                    const newEntry: WarningEntry = {
                      warningNumber: newCount,
                      reason: warningReason || warningUser.defaultReason,
                      message: warningMessage || warningUser.defaultMessage,
                      timestamp: new Date().toISOString(),
                    };

                    const updatedMap: UserWarningsMap = {
                      ...userWarnings,
                      [warningUser.user.user_id]: {
                        count: newCount,
                        history: [...currentRec.history, newEntry],
                      },
                    };

                    saveUserWarnings(updatedMap);
                    setWarningUser(null);

                    if (newCount >= 3) {
                      showMessage(
                        `Warning 3 of 3 issued to ${warningUser.user.full_name}. Suspend option is now unlocked.`,
                        "error"
                      );
                    } else {
                      showMessage(
                        `Warning ${newCount} of 3 recorded for ${warningUser.user.full_name}.`,
                        "success"
                      );
                    }
                  }}
                  className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-md"
                >
                  <span>🔔</span> Send Warning Notice ({nextNum} of 3)
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: SUSPEND / REACTIVATE USER */}
      {suspendingUser && (() => {
        const m = getUserOrderMetrics(suspendingUser.user, allOrders, policyThresholds);
        const userRec = userWarnings[suspendingUser.user.user_id];
        const priorHistory = userRec?.history || [];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <span>{suspendingUser.targetStatus === "SUSPENDED" ? "⛔" : "✓"}</span>
                {suspendingUser.targetStatus === "SUSPENDED" ? "Suspend Account" : "Reactivate Account"}
              </h3>
              <p className="text-xs text-slate-300">
                Are you sure you want to{" "}
                {suspendingUser.targetStatus === "SUSPENDED" ? "suspend" : "reactivate"} the account of{" "}
                <strong>{suspendingUser.user.full_name}</strong> ({suspendingUser.user.email})?
              </p>

              {/* Order track record breakdown */}
              <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-3 space-y-1.5 text-xs">
                <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <span>📊</span> Account Activity & Order Record:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div>
                    • {suspendingUser.user.role === "ARTIST" ? "Commissions Assigned" : "Orders Placed"}:{" "}
                    <strong className="text-white">{m.total}</strong>
                  </div>
                  <div>
                    • Completed: <strong className="text-emerald-400">{m.completed}</strong>
                  </div>
                  <div>
                    • Cancelled:{" "}
                    <strong className={m.cancelled > 0 ? "text-rose-400 font-bold" : "text-slate-300"}>
                      {m.cancelled}
                    </strong>
                  </div>
                  <div>
                    • {suspendingUser.user.role === "ARTIST" ? "Stalled / Unconfirmed" : "Unconfirmed Placed"}:{" "}
                    <strong className={m.unconfirmed > 0 ? "text-amber-400 font-bold" : "text-slate-300"}>
                      {m.unconfirmed}
                    </strong>
                  </div>
                </div>
              </div>

              {/* If Suspending: 3/3 Warnings Audit + Reason selector */}
              {suspendingUser.targetStatus === "SUSPENDED" ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-2.5 text-xs text-rose-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-rose-300">
                      <span>⚠️</span> 3 of 3 Policy Warnings Completed
                    </p>
                    <p className="text-[11px] text-rose-200/90 leading-relaxed">
                      This user was issued 3 prior warning notices regarding policy risk criteria. Because the behavior continues, administrative suspension is now authorized.
                    </p>
                    {priorHistory.length > 0 && (
                      <div className="pt-1.5 space-y-1 border-t border-rose-500/20 text-[10px] text-rose-200/80">
                        {priorHistory.map((h, i) => (
                          <div key={i} className="flex justify-between">
                            <span>Notice {h.warningNumber}: {h.reason}</span>
                            <span className="text-slate-400">{new Date(h.timestamp).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Reason for Suspension:
                    </label>
                    <select
                      value={suspensionReason}
                      onChange={(e) => setSuspensionReason(e.target.value)}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-brand font-medium"
                    >
                      <option value="Frequent unconfirmed or cancelled orders">Frequent unconfirmed or cancelled orders</option>
                      <option value="Stalled / unresponsive on commission assignments">Stalled / unresponsive on commission assignments</option>
                      <option value="Payment, chargeback, or fraud risk">Payment, chargeback, or fraud risk</option>
                      <option value="Violation of platform terms of service">Violation of platform terms of service</option>
                      <option value="Account inactivity or customer request">Account inactivity or customer request</option>
                      <option value="Other administrative policy violation">Other administrative policy violation</option>
                    </select>
                  </div>
                  <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
                    Suspended accounts cannot log in, place new orders, or receive commission assignments.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                  Reactivating this account will restore full login, ordering, and assignment capabilities, and reset their warning history.
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSuspendingUser(null)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateUserStatusMutation.mutate({
                      userId: suspendingUser.user.user_id,
                      status: suspendingUser.targetStatus,
                      reason: suspendingUser.targetStatus === "SUSPENDED" ? suspensionReason : undefined,
                    })
                  }
                  disabled={updateUserStatusMutation.isPending}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5 ${
                    suspendingUser.targetStatus === "SUSPENDED"
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {updateUserStatusMutation.isPending
                    ? "Updating..."
                    : suspendingUser.targetStatus === "SUSPENDED"
                    ? "Confirm Suspension"
                    : "Confirm Reactivation"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* MODAL: POLICY THRESHOLDS CONFIGURATOR */}
      {isPolicyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">⚙️</span>
                <div>
                  <h3 className="text-base font-bold text-white">Policy Thresholds & Risk Criteria</h3>
                  <p className="text-[11px] text-slate-400">Configure real-time safety limits & promotion eligibility</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPolicyModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Fine-tune operational limits for account suspension warnings and Admin role promotion. Values are saved locally and update all badge flags and action locks immediately across the dashboard.
            </p>

            <div className="space-y-4 text-xs">
              {/* SECTION: ARTIST PROMOTION TO ADMIN */}
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span>⭐</span>
                  <span>Artist Admin Elevation Policy</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Min Completed Orders
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={tempPolicy.minArtistCompletedOrders}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          minArtistCompletedOrders: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Completed commissions needed to qualify for Admin.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Max Stalled Assignments Allowed
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={tempPolicy.maxArtistStalledAssignments}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          maxArtistStalledAssignments: Math.max(0, parseInt(e.target.value) || 0),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Promotion blocked if stalled assignments exceed this.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: CUSTOMER RISK POLICY */}
              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-rose-300">
                  <span>⚠️</span>
                  <span>Customer Risk & Suspension Criteria</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Max Cancelled Orders
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={tempPolicy.maxCustomerCancelledOrders}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          maxCustomerCancelledOrders: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Flag as at-risk if cancellations hit this number.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Max Unconfirmed Placed (0 Done)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={tempPolicy.maxCustomerUnconfirmedPlaced}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          maxCustomerUnconfirmedPlaced: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Flag as at-risk if placed orders linger unconfirmed.
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION: ARTIST RISK POLICY */}
              <div className="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3.5 space-y-3">
                <div className="flex items-center gap-2 font-bold text-orange-300">
                  <span>🎨</span>
                  <span>Artist Risk & Performance Criteria</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Max Stalled Assigned Orders
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={tempPolicy.maxArtistStalledForRisk}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          maxArtistStalledForRisk: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Flag as at-risk if assignments remain unstarted.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-200 mb-1">
                      Max Cancelled Commissions
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={tempPolicy.maxArtistCancelledCommissions}
                      onChange={(e) =>
                        setTempPolicy((prev) => ({
                          ...prev,
                          maxArtistCancelledCommissions: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500 font-semibold"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Flag as at-risk if artist drops/cancels commissions.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  setTempPolicy(DEFAULT_POLICY_THRESHOLDS);
                }}
                className="text-xs text-slate-400 hover:text-amber-400 font-semibold underline underline-offset-2 transition"
              >
                Reset to Defaults
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPolicyModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPolicyThresholds(tempPolicy);
                    try {
                      localStorage.setItem("artifyme_policy_thresholds", JSON.stringify(tempPolicy));
                    } catch {
                      // ignore
                    }
                    setIsPolicyModalOpen(false);
                    showMessage("Policy criteria thresholds updated and applied successfully!", "success");
                  }}
                  className="rounded-lg bg-brand hover:bg-brand/90 px-4 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5 shadow-md shadow-brand/20"
                >
                  <span>💾</span> Save & Apply Criteria
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
