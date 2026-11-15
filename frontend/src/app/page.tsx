"use client";

import { useState } from "react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/hooks/use-locale";
import { copy } from "@/lib/i18n";

export default function HomePage() {
  const { locale, toggleLocale } = useLocale();
  const [uploadOpen, setUploadOpen] = useState(false);
  const t = copy[locale];

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader
        locale={locale}
        onToggleLocale={toggleLocale}
        variant="home"
        uploadOpen={uploadOpen}
        onUploadOpenChange={setUploadOpen}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
        <section className="animate-rise space-y-6">
          <p className="max-w-2xl text-lg leading-8 text-[var(--ink)] sm:text-xl sm:leading-9">
            {t.homeLead}
          </p>
          <p className="max-w-2xl text-base leading-7 text-[var(--muted)]">
            {t.tagline}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/chat"
              className="inline-flex h-12 items-center bg-[var(--accent)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              {t.ctaChat}
            </Link>
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className="inline-flex h-12 items-center border border-[var(--line)] px-6 text-sm text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
            >
              {t.ctaUpload}
            </button>
          </div>
        </section>

        <section
          id="knowledge"
          className="animate-rise mt-12 border border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_78%,white)] p-5 sm:p-7"
          style={{ animationDelay: "80ms" }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
            {t.creatorCvBadge}
          </p>
          <h2 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)] sm:text-3xl">
            {t.activeCvTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[var(--muted)]">
            {t.activeCvBody}
          </p>
          <ul className="mt-5 space-y-2 text-sm leading-6 text-[var(--ink)]">
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              Default: creator CV (`backend/data/CV.pdf`) + GitHub `@nikolajdza`
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              Upload PDF to try your resume for this visit only (refresh resets)
            </li>
            <li className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              Chat filters: All / CV only / GitHub only
            </li>
          </ul>

          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="mt-6 inline-flex h-11 items-center bg-[var(--accent)] px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            {t.ctaUpload}
          </button>
        </section>

        <section
          className="animate-rise mt-8 grid gap-3 sm:grid-cols-3"
          style={{ animationDelay: "140ms" }}
        >
          {["Hybrid RAG", "Citations", "Groq + fallback"].map((item) => (
            <div
              key={item}
              className="border border-[var(--line)] px-4 py-4 text-sm text-[var(--ink)]"
            >
              {item}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
