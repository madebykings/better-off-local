'use client';

import { useRef, useState } from 'react';
import { uploadRetailerImage, removeRetailerImage } from '@/lib/actions/branding';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadStatus = 'idle' | 'uploading' | 'error';

// ---------------------------------------------------------------------------
// ImageUploadZone
// ---------------------------------------------------------------------------

/**
 * Drag-and-drop / click-to-upload zone for a single retailer image slot
 * (logo or cover). Uploads immediately on file select — no Continue required.
 *
 * Calls the `uploadRetailerImage` server action, which optimises the image
 * server-side (resize + WebP) before writing to Storage and updating the DB.
 */
export function ImageUploadZone({
  slot,
  label,
  aspectHint,
  maxBytes,
  currentUrl,
  onUploaded,
  onRemoved,
}: {
  slot: 'logo' | 'cover';
  label: string;
  aspectHint: string;
  maxBytes: number;
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onRemoved: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  // Tracks the last URL confirmed by the server. Used to revert the preview
  // if a subsequent upload attempt fails — currentUrl (the initial prop) would
  // be stale after the first successful upload.
  const confirmedUrlRef = useRef<string | null>(currentUrl);

  const maxMB = Math.round(maxBytes / (1024 * 1024));

  function clientValidate(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Please upload a JPG, PNG, or WebP file.';
    }
    if (file.size > maxBytes) {
      return `File must be under ${maxMB} MB.`;
    }
    return null;
  }

  async function processFile(file: File) {
    const validationError = clientValidate(file);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Show a local preview immediately for responsiveness.
    const localPreview = URL.createObjectURL(file);
    setPreviewUrl(localPreview);
    setStatus('uploading');
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadRetailerImage(formData, slot);

    if ('error' in result) {
      // Revert to the last confirmed URL (not the initial prop, which may be
      // stale if the user already uploaded once this session).
      setPreviewUrl(confirmedUrlRef.current);
      setStatus('error');
      setErrorMessage(result.error);
      URL.revokeObjectURL(localPreview);
      return;
    }

    // Replace local blob URL with the confirmed Storage URL.
    URL.revokeObjectURL(localPreview);
    confirmedUrlRef.current = result.url;
    setPreviewUrl(result.url);
    setStatus('idle');
    onUploaded(result.url);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so re-selecting the same file fires onChange again.
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  async function handleRemove(e: React.MouseEvent) {
    e.stopPropagation();
    setStatus('uploading');
    setErrorMessage(null);

    const result = await removeRetailerImage(slot);

    setStatus('idle');
    if (result?.error) {
      setErrorMessage(result.error);
      return;
    }

    setPreviewUrl(null);
    onRemoved();
  }

  const isUploading = status === 'uploading';

  // ── With image ─────────────────────────────────────────────────────────
  if (previewUrl) {
    return (
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <div
          className={[
            'group relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50',
            slot === 'cover' ? 'aspect-[8/3]' : 'aspect-square w-28',
          ].join(' ')}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full object-cover"
          />

          {/* Overlay — shown on hover or while uploading */}
          <div
            className={[
              'absolute inset-0 flex items-center justify-center gap-2 bg-black/40 transition-opacity',
              isUploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            ].join(' ')}
          >
            {isUploading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-800 shadow transition-colors hover:bg-white"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-red-600 shadow transition-colors hover:bg-white"
                >
                  Remove
                </button>
              </>
            )}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="hidden"
          onChange={handleFileInput}
          disabled={isUploading}
        />

        {errorMessage && (
          <p className="text-xs text-red-500" role="alert">{errorMessage}</p>
        )}
      </div>
    );
  }

  // ── Empty drop zone ────────────────────────────────────────────────────
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
          slot === 'cover' ? 'aspect-[8/3]' : 'aspect-square w-28',
          isDragOver
            ? 'border-brand bg-brand/5'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100',
          isUploading ? 'cursor-default opacity-60' : '',
        ].join(' ')}
      >
        {isUploading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        ) : (
          <>
            <svg
              className="h-7 w-7 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
            <span className="text-[11px] font-medium text-gray-400">
              {isDragOver ? 'Drop to upload' : 'Upload photo'}
            </span>
          </>
        )}
      </div>

      <p className="text-[11px] text-gray-400">{aspectHint}</p>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleFileInput}
        disabled={isUploading}
      />

      {errorMessage && (
        <p className="text-xs text-red-500" role="alert">{errorMessage}</p>
      )}
    </div>
  );
}
