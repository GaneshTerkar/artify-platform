import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserProfileData {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  address: string;
  role: string;
  status: string;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    full_name: user?.full_name ?? "",
    email: user?.email ?? "",
    phone_number: user?.phone_number ?? "",
    address: user?.address ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch complete profile details from backend when modal opens
  useEffect(() => {
    if (!isOpen) {
      setSuccessMessage("");
      setErrorMessage("");
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    api<UserProfileData>("/api/user/profile")
      .then((data) => {
        if (isMounted) {
          setFormData({
            full_name: data.full_name || "",
            email: data.email || "",
            phone_number: data.phone_number || "",
            address: data.address || "",
          });
          // Update local auth context with fresh phone and address
          updateUser({
            full_name: data.full_name,
            phone_number: data.phone_number,
            address: data.address,
          });
        }
      })
      .catch((err) => {
        if (isMounted) {
          // Fallback to existing auth user data
          setFormData({
            full_name: user?.full_name ?? "",
            email: user?.email ?? "",
            phone_number: user?.phone_number ?? "",
            address: user?.address ?? "",
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSaving(true);

    try {
      const updated = await api<UserProfileData>("/api/user/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: formData.full_name.trim(),
          phone_number: formData.phone_number.trim(),
          address: formData.address.trim(),
        }),
      });

      // Update auth context state and localStorage
      updateUser({
        full_name: updated.full_name,
        phone_number: updated.phone_number,
        address: updated.address,
      });

      setSuccessMessage("Profile updated successfully!");
      setTimeout(() => {
        setSuccessMessage("");
        onClose();
      }, 1200);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  }

  const roleLabel =
    user?.role === "ADMIN"
      ? "Studio Administrator"
      : user?.role === "ARTIST"
      ? "Master Portrait Artist"
      : user?.role === "DELIVERY_AGENT"
      ? "Logistics & Delivery Partner"
      : "Verified Customer";

  const initials = formData.full_name
    ? formData.full_name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in">
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-700 bg-brand-muted p-6 sm:p-8 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 via-pink-500 to-amber-400 text-slate-950 font-black text-lg flex items-center justify-center shadow-md">
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Your Profile Settings</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                {roleLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Status Alerts */}
        {successMessage && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 text-xs text-emerald-300 font-semibold flex items-center gap-2 animate-in fade-in">
            <span>✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-300 font-semibold flex items-center gap-2 animate-in fade-in">
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Full Name
            </label>
            <input
              type="text"
              required
              disabled={isLoading || isSaving}
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none transition"
              placeholder="e.g. Ganesh Terkar"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
                Email Address
              </label>
              <span className="text-[10px] text-slate-400">Account login ID (Verified)</span>
            </div>
            <input
              type="email"
              disabled
              value={formData.email}
              className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
              Phone / WhatsApp Contact
            </label>
            <input
              type="tel"
              required
              disabled={isLoading || isSaving}
              value={formData.phone_number}
              onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none transition"
              placeholder="e.g. +91 8484937920"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
              {user?.role === "DELIVERY_AGENT"
                ? "Operating Hub / Dispatch Base Address"
                : user?.role === "ADMIN"
                ? "Studio Atelier / Administrative Address"
                : "Delivery / Shipping Address"}
            </label>
            <textarea
              required
              rows={3}
              disabled={isLoading || isSaving}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-brand focus:outline-none transition"
              placeholder="Flat No, Society, Street, City, Pincode..."
            />
          </div>

          {/* Artist Extra Notice */}
          {user?.role === "ARTIST" && (
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs text-purple-300 flex items-center justify-between">
              <span>Looking to update your artist bio and years of experience?</span>
              <Link
                to="/account"
                onClick={onClose}
                className="underline font-bold text-white hover:text-purple-200 ml-2 shrink-0"
              >
                Go to Artist Studio →
              </Link>
            </div>
          )}

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoading}
              className="rounded-xl bg-gradient-to-r from-cyan-500 via-pink-500 to-amber-400 text-slate-950 font-extrabold px-6 py-2.5 text-xs shadow-md shadow-pink-500/25 hover:opacity-90 active:scale-[0.98] transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Profile Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
