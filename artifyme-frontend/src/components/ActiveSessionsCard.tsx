import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

export interface UserSession {
  session_id: string;
  device_id: string;
  device_name: string;
  device_type: "DESKTOP" | "MOBILE" | "TABLET" | string;
  ip_address: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
  is_current: boolean;
}

export function ActiveSessionsCard() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const [feedback, setFeedback] = useState<{ text: string; isError?: boolean } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["user-sessions"],
    queryFn: () => api<{ sessions: UserSession[] }>("/api/auth/sessions"),
  });

  const sessions = data?.sessions ?? [];
  const otherSessionsCount = sessions.filter((s) => !s.is_current).length;

  const revokeMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return api<{ message: string }>(`/api/auth/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
    },
    onSuccess: (_, sessionId) => {
      setFeedback({ text: "Device session revoked successfully." });
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: Error) => {
      setFeedback({ text: err.message || "Failed to revoke session.", isError: true });
      setTimeout(() => setFeedback(null), 3500);
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: async () => {
      return api<{ message: string }>("/api/auth/sessions/revoke-others", {
        method: "POST",
      });
    },
    onSuccess: () => {
      setFeedback({ text: "All other devices logged out successfully." });
      queryClient.invalidateQueries({ queryKey: ["user-sessions"] });
      setTimeout(() => setFeedback(null), 3500);
    },
    onError: (err: Error) => {
      setFeedback({ text: err.message || "Failed to log out other devices.", isError: true });
      setTimeout(() => setFeedback(null), 3500);
    },
  });

  function getDeviceIcon(type: string) {
    switch (type.toUpperCase()) {
      case "MOBILE":
        return "📱";
      case "TABLET":
        return "📟";
      default:
        return "💻";
    }
  }

  function formatTime(timestamp: string) {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡️</span>
            <h2 className="text-lg font-bold text-white">Active Devices & Security</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
              {sessions.length} {sessions.length === 1 ? "device" : "devices"}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage logged-in devices across web and mobile. You can remotely terminate any session if you suspect unauthorized access.
          </p>
        </div>

        {otherSessionsCount > 0 && (
          <button
            onClick={() => revokeOthersMutation.mutate()}
            disabled={revokeOthersMutation.isPending}
            className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50 self-start sm:self-auto"
          >
            {revokeOthersMutation.isPending ? "Logging out..." : "Log Out All Other Devices"}
          </button>
        )}
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs font-medium border flex items-center justify-between ${
            feedback.isError
              ? "bg-rose-950/70 border-rose-500/60 text-rose-200"
              : "bg-emerald-950/70 border-emerald-500/60 text-emerald-200"
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Loading & Error States */}
      {isLoading && <p className="text-xs text-slate-400 py-3">Loading active sessions...</p>}
      {error && (
        <div className="text-xs text-rose-400 py-2 flex items-center justify-between">
          <span>Failed to load active sessions.</span>
          <button onClick={() => refetch()} className="underline hover:text-rose-300">
            Retry
          </button>
        </div>
      )}

      {/* Sessions List */}
      {!isLoading && !error && (
        <div className="space-y-2.5">
          {sessions.map((sess) => (
            <div
              key={sess.session_id}
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition ${
                sess.is_current
                  ? "bg-slate-800/60 border-emerald-500/40"
                  : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{getDeviceIcon(sess.device_type)}</span>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">
                      {sess.device_name || "Unknown Device"}
                    </span>
                    {sess.is_current ? (
                      <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                        This Device
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                        Remote
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>IP: {sess.ip_address === "::1" || sess.ip_address === "127.0.0.1" ? "Localhost" : sess.ip_address}</span>
                    <span>•</span>
                    <span>Last active: {formatTime(sess.last_active_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {sess.is_current ? (
                  <button
                    onClick={() => logout()}
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition"
                  >
                    Log Out
                  </button>
                ) : (
                  <button
                    onClick={() => revokeMutation.mutate(sess.session_id)}
                    disabled={revokeMutation.isPending}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition disabled:opacity-50"
                  >
                    {revokeMutation.isPending ? "Revoking..." : "Revoke Session"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
