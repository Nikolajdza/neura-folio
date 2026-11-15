"use client";

import type { ChatSource } from "@/lib/chat";

type SourceBadgesProps = {
  sources: ChatSource[];
  onSelect: (source: ChatSource) => void;
  label: string;
};

export function SourceBadges({ sources, onSelect, label }: SourceBadgesProps) {
  if (sources.length === 0) {
    return null;
  }

  const unique = Array.from(
    new Map(sources.map((source) => [source.label, source])).values(),
  );

  return (
    <div className="mt-4">
      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {unique.map((source) => (
          <button
            key={source.id}
            type="button"
            onClick={() => onSelect(source)}
            className="inline-flex items-center gap-1.5 border border-[var(--line)] bg-[var(--chip)] px-2.5 py-1.5 text-left text-[11px] tracking-wide text-[var(--muted)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--ink)]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            {source.label}
            <span className="text-[10px] opacity-70">
              {(source.similarity * 100).toFixed(0)}%
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
