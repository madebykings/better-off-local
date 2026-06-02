'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadVenueImage } from '@/lib/actions/branding';

interface Props {
  locationId: string;
  slot: 'logo' | 'cover';
  label: string;
  hint: string;
  currentUrl: string | null;
}

export function VenueImageUpload({ locationId, slot, label, hint, currentUrl }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setError(null);
    const fd = new FormData();
    fd.append('file', file);

    startTransition(async () => {
      const result = await uploadVenueImage(fd, locationId, slot);
      if ('url' in result) {
        setPreview(result.url);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-2">{hint}</p>

      {error && (
        <p className="mb-2 text-xs text-red-500">{error}</p>
      )}

      {preview && (
        <div className="mb-2 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className={`rounded-lg border border-gray-200 object-cover ${slot === 'logo' ? 'w-20 h-20' : 'w-full max-h-32'}`}
          />
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isPending}
        className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Uploading…' : preview ? 'Replace image' : 'Upload image'}
      </button>
    </div>
  );
}
