import React, { useState, useEffect } from "react";

interface CollageArtworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  finalImageUrl: string;
  refImageUrl?: string;
  collageImageUrl?: string;
  category?: string;
  size?: string;
  artistName?: string;
  isPublishedToGallery?: boolean;
  onConfirmPublish?: () => void;
  isConfirming?: boolean;
  onAssignDeliveryAgent?: () => void;
}

export const CollageArtworkModal: React.FC<CollageArtworkModalProps> = ({
  isOpen,
  onClose,
  orderId,
  finalImageUrl,
  refImageUrl,
  collageImageUrl,
  category,
  size,
  artistName,
  isPublishedToGallery,
  onConfirmPublish,
  isConfirming,
  onAssignDeliveryAgent,
}) => {
  const [viewMode, setViewMode] = useState<"collage" | "sketch" | "reference" | "split">("collage");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const downloadTarget = collageImageUrl || finalImageUrl;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden rounded-2xl bg-brand-surface border border-slate-700 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 text-lg">✦</span>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                Artwork Inspection & Collage
                <span className="font-mono text-xs text-slate-400 font-normal">
                  #{orderId.slice(0, 8)}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {category || "Portrait"} {size ? `• ${size}` : ""}{" "}
                {artistName ? `• Artist: ${artistName}` : ""}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center transition"
            title="Close (Esc)"
          >
            ✕
          </button>
        </div>

        {/* View Mode Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-slate-800 bg-slate-950/60 text-xs">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setViewMode("collage")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === "collage"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🖼️ Combined Collage
            </button>
            <button
              onClick={() => setViewMode("sketch")}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === "sketch"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              🎨 Finished Sketch
            </button>
            {refImageUrl && (
              <button
                onClick={() => setViewMode("reference")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  viewMode === "reference"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📷 Customer Reference
              </button>
            )}
            {refImageUrl && (
              <button
                onClick={() => setViewMode("split")}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  viewMode === "split"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                ◫ Side-by-Side
              </button>
            )}
          </div>

          {/* Action Download & Publish Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onAssignDeliveryAgent && (
              <button
                type="button"
                onClick={onAssignDeliveryAgent}
                className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3.5 py-1.5 font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm text-xs"
              >
                <span>🚚</span> Assign Delivery Agent
              </button>
            )}
            {onConfirmPublish && (
              isPublishedToGallery ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-950/70 border border-emerald-500/50 px-3 py-1.5 text-xs font-semibold text-emerald-300">
                  <span>✓</span> Published
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onConfirmPublish}
                  disabled={isConfirming}
                  className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  <span>✓</span> {isConfirming ? "Publishing..." : "Publish Artwork"}
                </button>
              )
            )}
            {collageImageUrl && (
              <a
                href={collageImageUrl}
                download={`collage_${orderId.slice(0, 8)}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg bg-emerald-700/80 hover:bg-emerald-600 px-3 py-1.5 font-semibold text-white transition inline-flex items-center gap-1.5 shadow-sm"
              >
                <span>↓</span> Download Collage
              </a>
            )}
            <a
              href={finalImageUrl}
              download={`sketch_${orderId.slice(0, 8)}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 font-medium text-slate-300 transition inline-flex items-center gap-1.5"
            >
              <span>↓</span> Download Sketch
            </a>
          </div>
        </div>

        {/* Main Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950/80 min-h-[350px]">
          {/* 1. COLLAGE MODE (Matching User's media_1792255697671_648adc46.jpg) */}
          {viewMode === "collage" && (
            <div className="relative max-h-[68vh] flex items-center justify-center">
              {collageImageUrl ? (
                <img
                  src={collageImageUrl}
                  alt="Finished Artwork Collage"
                  className="max-h-[68vh] w-auto object-contain rounded-xl shadow-2xl border border-slate-800"
                />
              ) : (
                /* Dynamic overlay view if collage is still processing */
                <div className="relative max-h-[68vh] inline-block rounded-xl overflow-hidden shadow-2xl border border-slate-800">
                  <img
                    src={finalImageUrl}
                    alt="Finished Artwork"
                    className="max-h-[68vh] w-auto object-contain"
                  />
                  {refImageUrl && (
                    <div className="absolute bottom-3 left-3 w-1/4 max-w-[140px] aspect-[3/4] rounded-md overflow-hidden border-2 border-white shadow-2xl bg-black/60">
                      <img
                        src={refImageUrl}
                        alt="Reference Inset"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. FINISHED SKETCH ONLY */}
          {viewMode === "sketch" && (
            <div className="max-h-[68vh] flex items-center justify-center">
              <img
                src={finalImageUrl}
                alt="Finished Sketch Only"
                className="max-h-[68vh] w-auto object-contain rounded-xl shadow-2xl border border-slate-800"
              />
            </div>
          )}

          {/* 3. CUSTOMER REFERENCE PHOTO ONLY */}
          {viewMode === "reference" && refImageUrl && (
            <div className="max-h-[68vh] flex items-center justify-center">
              <img
                src={refImageUrl}
                alt="Original Reference"
                className="max-h-[68vh] w-auto object-contain rounded-xl shadow-2xl border border-slate-800"
              />
            </div>
          )}

          {/* 4. SIDE-BY-SIDE SPLIT VIEW */}
          {viewMode === "split" && refImageUrl && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-h-[68vh] items-center">
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Original Reference Photo
                </span>
                <img
                  src={refImageUrl}
                  alt="Reference"
                  className="max-h-[60vh] w-auto object-contain rounded-xl border border-slate-800 shadow-xl"
                />
              </div>

              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">
                  Hand-Drawn Artwork
                </span>
                <img
                  src={finalImageUrl}
                  alt="Finished Sketch"
                  className="max-h-[60vh] w-auto object-contain rounded-xl border border-emerald-500/40 shadow-xl"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-0 text-[11px] text-slate-400">
          <span>
            {viewMode === "collage"
              ? "✓ Reference photo is composited in the bottom-left corner with authentic border"
              : "Use the top tabs to switch between Collage, Sketch, Reference, and Side-by-Side views"}
          </span>
          <span className="text-slate-400 font-mono">ArtifyMe Canvas Engine</span>
        </div>
      </div>
    </div>
  );
};
