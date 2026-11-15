"use client";

import type { ChatSource } from "@/lib/chat";

type CitationDrawerProps = {
  source: ChatSource | null;
  onClose: () => void;
  title: string;
};

export function CitationDrawer({ source, onClose, title }: CitationDrawerProps) {
  if (!source) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="animate-rise relative z-10 m-3 w-full max-w-xl border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_24px_80px_rgba(20,24,31,0.18)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
              {title}
            </p>
            <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]">
              {source.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Similarity {(source.similarity * 100).toFixed(1)}%
        </p>
        <div className="max-h-[50vh] overflow-y-auto border border-[var(--line)] bg-[var(--chip)] p-4 text-sm leading-7 text-[var(--ink)] whitespace-pre-wrap">
          {source.excerpt ?? "No excerpt available."}
        </div>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-block text-sm text-[var(--accent)] underline underline-offset-2"
          >
            Open source →
          </a>
        ) : null}
      </aside>
    </div>
  );
}
