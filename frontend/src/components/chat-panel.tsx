"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  getMessageFollowUps,
  getMessageSources,
  getMessageText,
  type ChatSource,
  type NeuraUIMessage,
} from "@/lib/chat";
import { copy, type Locale } from "@/lib/i18n";
import { CitationDrawer } from "@/components/citation-drawer";
import { useSession } from "@/components/session-provider";
import { SourceBadges } from "@/components/source-badges";

const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ??
  "http://localhost:3001";

type SourceFilter = "all" | "cv" | "github";

type ChatPanelProps = {
  locale: Locale;
};

export function ChatPanel({ locale }: ChatPanelProps) {
  const t = copy[locale];
  const { sessionId } = useSession();
  const [input, setInput] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const sourceFilterRef = useRef<SourceFilter>("all");
  const sessionIdRef = useRef<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ChatSource | null>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sourceFilterRef.current = sourceFilter;
  }, [sourceFilter]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<NeuraUIMessage>({
        api: `${backendUrl}/api/chat`,
        body: () => ({
          sourceFilter: sourceFilterRef.current,
          sessionId: sessionIdRef.current ?? undefined,
        }),
      }),
    [],
  );

  const { messages, sendMessage, status, error, stop, clearError } =
    useChat<NeuraUIMessage>({
      transport,
    });

  const isBusy = status === "submitted" || status === "streaming";
  const lastAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");
  const followUps = lastAssistant ? getMessageFollowUps(lastAssistant) : [];

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const onScroll = () => {
      const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
      setStickToBottom(distance < 96);
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!stickToBottom) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status, stickToBottom]);

  async function ask(text: string) {
    const value = text.trim();
    if (!value || isBusy) {
      return;
    }
    clearError();
    setStickToBottom(true);
    await sendMessage({ text: value });
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text) {
      return;
    }
    setInput("");
    await ask(text);
  }

  const filters: Array<{ id: SourceFilter; label: string }> = [
    { id: "all", label: t.filterAll },
    { id: "cv", label: t.filterCv },
    { id: "github", label: t.filterGithub },
  ];

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-[var(--line)] px-4 py-3 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
          <span className="mr-1 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            {t.filterLabel}
          </span>
          {filters.map((filter) => {
            const active = sourceFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSourceFilter(filter.id)}
                className={`px-3 py-1.5 text-xs tracking-wide transition-colors ${
                  active
                    ? "bg-[var(--ink)] text-[var(--paper)]"
                    : "border border-[var(--line)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--ink)]"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          {messages.length === 0 ? (
            <div className="animate-rise space-y-6 pt-2">
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                {t.empty}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {t.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void ask(suggestion)}
                    className="border border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_65%,white)] px-3 py-4 text-left text-sm leading-6 text-[var(--ink)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent)]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((message, index) => {
            const text = getMessageText(message);
            const sources = getMessageSources(message);
            const isUser = message.role === "user";
            const isLast = index === messages.length - 1;

            return (
              <article
                key={message.id}
                className={`animate-rise ${
                  isUser ? "ml-auto max-w-[min(100%,34rem)]" : "mr-auto w-full"
                }`}
              >
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                  {isUser ? t.you : t.assistant}
                </p>
                <div
                  className={
                    isUser
                      ? "bg-[var(--ink)] px-4 py-3 text-[15px] leading-7 text-[var(--paper)]"
                      : "border-l-2 border-[var(--accent)] pl-5 text-[var(--ink)]"
                  }
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <div className="prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {text || (isBusy && isLast ? "…" : "")}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {!isUser ? (
                  <SourceBadges
                    sources={sources}
                    label={t.sources}
                    onSelect={setSelectedSource}
                  />
                ) : null}
              </article>
            );
          })}

          {status === "submitted" ? (
            <p className="status-pulse text-sm text-[var(--muted)]">
              {t.searching}
            </p>
          ) : null}
          {status === "streaming" ? (
            <p className="status-pulse text-sm text-[var(--muted)]">
              {t.generating}
            </p>
          ) : null}

          {!isBusy && followUps.length > 0 ? (
            <div className="animate-rise space-y-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                {t.followUps}
              </p>
              <div className="flex flex-wrap gap-2">
                {followUps.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void ask(item)}
                    className="border border-[var(--line)] px-3 py-2 text-sm leading-5 text-[var(--ink)] transition-colors hover:border-[var(--accent)] hover:bg-[var(--chip)]"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error.message}
            </p>
          ) : null}

          <div ref={bottomRef} className="h-4" />
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="sticky bottom-0 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] px-4 py-4 backdrop-blur-md sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-3xl items-end gap-3">
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            id="chat-input"
            rows={1}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={t.placeholder}
            className="max-h-40 min-h-12 flex-1 resize-y border border-[var(--line)] bg-[var(--paper)] px-4 py-3 text-[15px] leading-6 text-[var(--ink)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => void stop()}
              className="h-12 shrink-0 border border-[var(--line)] px-4 text-sm text-[var(--ink)] transition-colors hover:bg-[var(--chip)]"
            >
              {t.stop}
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-12 shrink-0 bg-[var(--accent)] px-5 text-sm font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.send}
            </button>
          )}
        </div>
      </form>

      <CitationDrawer
        source={selectedSource}
        onClose={() => setSelectedSource(null)}
        title={t.sources}
      />
    </section>
  );
}
