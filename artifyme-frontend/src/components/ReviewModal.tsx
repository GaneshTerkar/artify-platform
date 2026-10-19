import React, { useState, useEffect } from "react";
import type { Order, Review } from "../types/order";
import { api } from "../lib/api";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  order,
  onSuccess,
}) => {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [unboxingPhotoUrl, setUnboxingPhotoUrl] = useState("");
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const ratingDescriptions: Record<number, string> = {
    5: "⭐⭐⭐⭐⭐ Outstanding masterpiece! Exceeded expectations.",
    4: "⭐⭐⭐⭐ Very happy with the portrait and craftmanship.",
    3: "⭐⭐⭐ Good artwork, met basic expectations.",
    2: "⭐⭐ Needs improvement in resemblance or detail.",
    1: "⭐ Unhappy with the commissioned work.",
  };

  useEffect(() => {
    if (order && isOpen) {
      setError("");
      setSuccessMsg("");
      setIsLoading(true);
      // Check if review already exists for this order
      api<{ review: Review | null }>(`/api/v1/reviews/order/${order.order_id}`)
        .then((res) => {
          if (res.review) {
            setExistingReview(res.review);
            setRating(res.review.rating);
            setTitle(res.review.title);
            setComment(res.review.comment);
            setUnboxingPhotoUrl(res.review.unboxing_photo_url || "");
          } else {
            setExistingReview(null);
            setRating(5);
            setTitle("");
            setComment("");
            setUnboxingPhotoUrl("");
          }
        })
        .catch(() => {
          setExistingReview(null);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) {
      setError("Please write a few words about your commissioned artwork.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await api<{ message: string; review: Review }>("/api/v1/reviews", {
        method: "POST",
        body: JSON.stringify({
          order_id: order.order_id,
          rating,
          title: title.trim() || undefined,
          comment: comment.trim(),
          unboxing_photo_url: unboxingPhotoUrl.trim() || undefined,
        }),
      });
      setSuccessMsg("Thank you! Your verified review has been submitted.");
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to submit review");
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
            <span className="text-xl">⭐</span>
            <div>
              <h2 className="text-base font-bold text-white">
                {existingReview ? "Your Verified Review" : "Rate & Review Artwork"}
              </h2>
              <p className="text-xs text-slate-400">
                Commission #{order.order_id.slice(0, 8)} • {order.painting_category}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-400">Loading review details...</div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
                {successMsg}
              </div>
            )}

            {/* Star Rating Selector */}
            <div className="text-center py-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
              <label className="block text-xs font-semibold text-slate-400 mb-2">
                Overall Satisfaction & Quality
              </label>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    disabled={Boolean(existingReview)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="text-3xl transition transform hover:scale-125 focus:outline-none"
                  >
                    <span
                      className={
                        (hoverRating || rating) >= star ? "text-amber-400" : "text-slate-600"
                      }
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-medium text-amber-300">
                {ratingDescriptions[hoverRating || rating]}
              </p>
            </div>

            {/* Review Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Headline / Title
              </label>
              <input
                type="text"
                placeholder="e.g. Masterful oil portrait of my grandfather!"
                value={title}
                disabled={Boolean(existingReview)}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            {/* Review Comment */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Your Detailed Feedback
              </label>
              <textarea
                rows={3}
                placeholder="Describe the artist's attention to detail, texture quality, packaging safety, or likeness to reference photo..."
                value={comment}
                disabled={Boolean(existingReview)}
                onChange={(e) => setComment(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            {/* Unboxing / Wall Photo URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Unboxing or Wall Photo URL (Optional)
              </label>
              <input
                type="text"
                placeholder="https://..."
                value={unboxingPhotoUrl}
                disabled={Boolean(existingReview)}
                onChange={(e) => setUnboxingPhotoUrl(e.target.value)}
                className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Show off how your framed artwork looks mounted in your home!
              </p>
            </div>

            {existingReview && existingReview.is_featured && (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/30 p-2.5 text-xs text-purple-300 flex items-center gap-2">
                <span>🌟</span>
                <span>Featured Testimonial on ArtifyMe Homepage</span>
              </div>
            )}

            {/* Footer Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-xs font-medium text-slate-400 hover:text-white transition"
              >
                {existingReview ? "Close" : "Cancel"}
              </button>
              {!existingReview && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 px-5 py-2 text-xs font-bold text-slate-950 transition flex items-center gap-1.5 shadow-lg shadow-amber-950/50"
                >
                  <span>⭐</span>
                  <span>{isSubmitting ? "Submitting..." : "Submit Verified Review"}</span>
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
