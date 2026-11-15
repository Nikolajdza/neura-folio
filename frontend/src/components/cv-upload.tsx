"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Locale } from "@/lib/i18n";
import { copy } from "@/lib/i18n";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type CvUploadProps = {
  locale: Locale;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  triggerLabel?: string;
  triggerClassName?: string;
};

export function CvUpload({
  locale,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  triggerLabel,
  triggerClassName,
}: CvUploadProps) {
  const t = copy[locale];
  const { sessionId, hasSessionCv, setSessionCv, clearSessionCv } = useSession();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setBusy(true);
    setStatus(t.uploading);
    try {
      const body = new FormData();
      body.append("file", file);
      const headers: HeadersInit = {};
      if (sessionId) {
        headers["x-session-id"] = sessionId;
      }

      const response = await fetch(`${backendUrl}/api/session/cv`, {
        method: "POST",
        headers,
        body,
      });
      const json = (await response.json()) as {
        message?: string;
        error?: string;
        inserted?: number;
        sessionId?: string;
      };
      if (!response.ok) {
        throw new Error(json.error ?? `Upload failed (${response.status})`);
      }
      if (!json.sessionId) {
        throw new Error("Upload succeeded but no sessionId returned");
      }
      setSessionCv(json.sessionId);
      setStatus(
        `${t.uploaded}: ${json.inserted ?? 0} chunks. ${t.sessionCvActive}`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <>
      {showTrigger ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ??
            "border border-[var(--line)] bg-[var(--paper)] px-3 py-1.5 text-xs tracking-wide text-[var(--ink)] transition-colors hover:border-[var(--accent)]"
          }
        >
          {triggerLabel ?? t.upload}
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="Close upload dialog"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_45%,transparent)] backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv-upload-title"
            className="animate-rise relative z-10 m-3 w-full max-w-md border border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_24px_80px_rgba(20,24,31,0.2)] sm:p-6"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  PDF
                </p>
                <h2
                  id="cv-upload-title"
                  className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--ink)]"
                >
                  {t.upload}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)] hover:text-[var(--ink)]"
              >
                ✕
              </button>
            </div>

            <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
              {t.uploadHint}
            </p>

            {hasSessionCv ? (
              <p className="mb-4 border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2 text-sm text-[var(--ink)]">
                {t.sessionCvActive}
              </p>
            ) : (
              <p className="mb-4 text-sm text-[var(--muted)]">
                {t.creatorCvBadge}: {t.sessionCvDefault}
              </p>
            )}

            <label className="inline-flex cursor-pointer items-center justify-center bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90">
              {busy ? t.uploading : "Choose PDF"}
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                disabled={busy}
                onChange={(event) => void onFileChange(event)}
              />
            </label>

            {hasSessionCv ? (
              <button
                type="button"
                onClick={() => {
                  clearSessionCv();
                  setStatus(t.sessionCvCleared);
                }}
                className="ml-3 border border-[var(--line)] px-3 py-2 text-sm text-[var(--ink)] hover:border-[var(--accent)]"
              >
                {t.useCreatorCv}
              </button>
            ) : null}

            {status ? (
              <p className="mt-4 text-sm text-[var(--muted)]">{status}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
