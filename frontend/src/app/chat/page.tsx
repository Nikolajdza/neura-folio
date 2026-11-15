"use client";

import { ChatPanel } from "@/components/chat-panel";
import { SiteHeader } from "@/components/site-header";
import { useLocale } from "@/hooks/use-locale";

export default function ChatPage() {
  const { locale, toggleLocale } = useLocale();

  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <SiteHeader locale={locale} onToggleLocale={toggleLocale} variant="chat" />
      <main className="flex min-h-0 flex-1 flex-col">
        <ChatPanel locale={locale} />
      </main>
    </div>
  );
}
