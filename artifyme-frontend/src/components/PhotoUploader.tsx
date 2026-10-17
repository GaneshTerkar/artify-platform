import React, { useRef, useState } from "react";
import { uploadFile } from "../lib/api";

interface PhotoUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export default function PhotoUploader({ value, onChange }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewSrc = localPreview || value;

  async function handleFile(file: File) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPG, PNG, WEBP, HEIC, GIF).");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("Image file size must be less than 20MB.");
      return;
    }

    setError(null);
    setFileName(file.name);

    // Instant local preview
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);

    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      onChange(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset input so same file can be selected again if needed
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleRemove() {
    setLocalPreview(null);
    setFileName(null);
    setError(null);
    onChange("");
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* When a photo is selected / uploaded */}
      {previewSrc ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-600 bg-brand-muted p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-lg border border-slate-600 bg-slate-900">
              <img
                src={previewSrc}
                alt="Reference preview"
                className="h-full w-full object-cover"
              />
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div>
                <p className="text-sm font-medium text-white truncate max-w-xs">
                  {fileName || "Reference Photo"}
                </p>
                {isUploading ? (
                  <p className="text-xs text-brand animate-pulse">Uploading to storage...</p>
                ) : (
                  <p className="text-xs text-emerald-400 flex items-center justify-center sm:justify-start gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Ready for artist
                  </p>
                )}
              </div>

              <div className="flex gap-2 justify-center sm:justify-start">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-500 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
                >
                  Change photo
                </button>
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={handleRemove}
                  className="rounded-lg border border-red-500/50 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Upload dropzone when no photo is selected */
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            isDragging
              ? "border-brand bg-brand/10"
              : "border-slate-600 bg-brand-muted hover:border-slate-500 hover:bg-slate-800/60"
          }`}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-brand">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>

          <p className="text-sm font-medium text-white">
            Browse files from your device or phone
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Tap to open photo gallery / camera, or drag and drop here
          </p>
          <p className="mt-2 text-[11px] text-slate-500">
            Supports JPG, PNG, WEBP, HEIC (up to 20MB)
          </p>

          <button
            type="button"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90"
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Choose Photo
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Manual URL fallback */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          {showUrlInput ? "Hide manual URL input" : "Or enter image URL manually"}
        </button>

        {showUrlInput && (
          <div className="mt-2 space-y-1">
            <input
              type="url"
              className="w-full rounded-lg border border-slate-600 bg-brand-muted px-3 py-2 text-sm text-white placeholder-slate-500"
              placeholder="https://example.com/reference-photo.jpg"
              value={value}
              onChange={(e) => {
                setLocalPreview(null);
                setFileName("Custom URL");
                onChange(e.target.value);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
