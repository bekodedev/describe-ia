'use client';

import { IMAGE_MAX_BYTES, IMAGE_TYPES } from '@describe-ia/shared';
import { useEffect, useState, type DragEvent } from 'react';
import { formatBytes } from '@/lib/format';
import { checkPhoto } from '@/lib/photo';
import { Button } from './ui';

interface Props {
  file: File | null;
  onChange: (file: File | null) => void;
}

export function PhotoDropzone({ file, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(candidate: File | undefined) {
    if (!candidate) return;
    const problem = checkPhoto(candidate);
    setError(problem);
    if (!problem) onChange(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files[0]);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">
        Photo <span className="font-normal text-slate-600">(optional)</span>
      </p>

      {file ? (
        <div className="mt-2 flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
          {previewUrl && (
            <img
              src={previewUrl}
              alt={`Preview of ${file.name}`}
              className="size-20 shrink-0 rounded-lg bg-white object-cover"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
            <p className="text-sm text-slate-600">{formatBytes(file.size)}</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => onChange(null)}
            aria-label={`Remove photo ${file.name}`}
          >
            Remove
          </Button>
        </div>
      ) : (
        <label
          htmlFor="photo"
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-700 ${
            dragging
              ? 'border-indigo-600 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-slate-400'
          }`}
        >
          <svg
            className="mb-1 size-8 text-slate-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
            />
          </svg>
          <span className="text-sm">
            <span className="font-semibold text-indigo-800">Choose a photo</span>
            <span className="text-slate-700"> or drag it here</span>
          </span>
          <span className="text-sm text-slate-600">
            JPEG, PNG or WebP, up to {IMAGE_MAX_BYTES / 1024 / 1024} MB
          </span>
          <input
            id="photo"
            type="file"
            accept={IMAGE_TYPES.join(',')}
            className="sr-only"
            aria-describedby={error ? 'photo-error' : undefined}
            onChange={(event) => {
              accept(event.target.files?.[0]);
              event.target.value = ''; // picking the same file again must fire onChange
            }}
          />
        </label>
      )}

      {error && (
        <p id="photo-error" role="alert" className="mt-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
