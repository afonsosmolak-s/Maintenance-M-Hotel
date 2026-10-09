"use client";

import { useEffect, useId, useMemo } from "react";

const MAX_PHOTOS = 6;

/** Escolha de fotos com pré-visualização. No celular, o sistema oferece câmera ou galeria. */
export function PhotoPicker({
  label = "Fotos",
  hint = "Opcional. Evite pessoas e objetos pessoais nas fotos.",
  files,
  onChange,
}: {
  label?: string;
  hint?: string;
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const id = useId();
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="text-sm file:mr-3 file:h-10 file:rounded-[var(--radius-control)] file:border file:border-line file:bg-paper file:px-4 file:text-sm file:font-semibold"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          onChange([...files, ...picked].slice(0, MAX_PHOTOS));
          event.target.value = "";
        }}
      />
      <p className="text-xs text-muted">
        {hint} Até {MAX_PHOTOS} fotos.
      </p>
      {previews.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {previews.map((src, index) => (
            <li key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`Foto ${index + 1}`} className="h-20 w-20 rounded-[var(--radius-control)] object-cover" />
              <button
                type="button"
                aria-label={`Remover foto ${index + 1}`}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-paper"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
