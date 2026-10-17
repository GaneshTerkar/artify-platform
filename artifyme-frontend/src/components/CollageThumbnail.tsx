import React from "react";

interface CollageThumbnailProps {
  finalImageUrl: string;
  refImageUrl?: string;
  collageImageUrl?: string;
  onClick?: () => void;
  className?: string;
  sizeClass?: string;
  badgeText?: string;
}

export const CollageThumbnail: React.FC<CollageThumbnailProps> = ({
  finalImageUrl,
  refImageUrl,
  collageImageUrl,
  onClick,
  className = "",
  sizeClass = "w-24 h-24",
  badgeText = "Collage",
}) => {
  // If server-generated collage exists, render the composite directly
  if (collageImageUrl) {
    return (
      <div
        onClick={onClick}
        className={`relative ${sizeClass} rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/50 flex-shrink-0 cursor-pointer group shadow-lg ${className}`}
        title="View Combined Collage Artwork (Sketch + Reference Photo)"
      >
        <img
          src={collageImageUrl}
          alt="Combined Artwork Collage"
          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
          loading="lazy"
        />
        <div className="absolute top-1 right-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
          {badgeText}
        </div>
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white">
          Inspect
        </div>
      </div>
    );
  }

  // Dynamic fallback rendering with bottom-left picture-in-picture inset
  return (
    <div
      onClick={onClick}
      className={`relative ${sizeClass} rounded-xl overflow-hidden bg-slate-900 border border-emerald-500/50 flex-shrink-0 cursor-pointer group shadow-lg ${className}`}
      title="View Combined Collage Artwork (Sketch + Reference Photo)"
    >
      {/* Main Completed Sketch */}
      <img
        src={finalImageUrl}
        alt="Final Sketch"
        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
        loading="lazy"
      />

      {/* Picture-in-picture: Reference photo in bottom-left corner with white border */}
      {refImageUrl && (
        <div className="absolute bottom-1.5 left-1.5 w-1/3 aspect-[3/4] rounded-[3px] overflow-hidden border border-white shadow-md bg-black/80 z-10 pointer-events-none">
          <img
            src={refImageUrl}
            alt="Reference Inset"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div className="absolute top-1 right-1 bg-emerald-600/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
        {badgeText}
      </div>

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition text-xs font-semibold text-white z-20">
        Inspect
      </div>
    </div>
  );
};
