"use client";

import Link from "next/link";
import { CvUpload } from "@/components/cv-upload";
import { useSession } from "@/components/session-provider";
import { copy, type Locale } from "@/lib/i18n";

type SiteHeaderProps = {
  locale: Locale;
  onToggleLocale: () => void;
  variant?: "home" | "chat";
  uploadOpen?: boolean;
  onUploadOpenChange?: (open: boolean) => void;
};

export function SiteHeader({
  locale,
  onToggleLocale,
  variant = "home",
  uploadOpen,
  onUploadOpenChange,
}: SiteHeaderProps) {
  const t = copy[locale];
  const { hasSessionCv } = useSession();

  return (
    <header className="relative z-40 border-b border-[var(--line)] px-4 py-5 sm:px-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] blur-3xl" />
      <div className="relative mx-auto flex w-full max-w-3xl items-end justify-between gap-4">
        <div>
          {variant === "chat" ? (
            <Link
              href="/"
              className="mb-2 inline-flex text-[11px] uppercase tracking-[0.18em] text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
            >
              ← {t.backHome}
            </Link>
          ) : (
            <p className="mb-1 text-[11px] uppercase tracking-[0.22em] text-[var(--muted)]">
              {t.eyebrow}
            </p>
          )}
          <Link href="/" className="no-underline">
            <h1 className="font-[family-name:var(--font-display)] text-3xl leading-none tracking-tight text-[var(--ink)] sm:text-4xl">
              NeuraFolio
            </h1>
          </Link>
          <div className="brand-rule mt-3 h-px w-24 bg-[var(--accent)]" />
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="hidden border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[var(--accent)] sm:inline">
              {hasSessionCv ? t.guestCvBadge : t.creatorCvBadge}
            </span>
            <CvUpload
              locale={locale}
              open={uploadOpen}
              onOpenChange={onUploadOpenChange}
            />
            <button
              type="button"
              onClick={onToggleLocale}
              className="border border-[var(--line)] px-3 py-1.5 text-xs tracking-wide text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              {t.lang}
            </button>
          </div>
          {variant === "chat" ? (
            <p className="max-w-[14rem] text-right text-[11px] leading-relaxed text-[var(--muted)]">
              {t.tagline}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
