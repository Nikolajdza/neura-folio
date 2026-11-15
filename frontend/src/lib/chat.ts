import type { UIMessage } from "ai";

export type ChatSource = {
  id: number;
  label: string;
  url?: string;
  similarity: number;
  excerpt?: string;
};

export type NeuraUIMessage = UIMessage<
  never,
  {
    sources: ChatSource[];
    provider: string;
    status: string;
    followUps: string[];
  }
>;

export function getMessageText(message: NeuraUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getMessageSources(message: NeuraUIMessage): ChatSource[] {
  const sources: ChatSource[] = [];
  for (const part of message.parts) {
    if (part.type === "data-sources" && Array.isArray(part.data)) {
      sources.push(...part.data);
    }
  }
  return sources;
}

export function getMessageFollowUps(message: NeuraUIMessage): string[] {
  for (const part of message.parts) {
    if (part.type === "data-followUps" && Array.isArray(part.data)) {
      return part.data;
    }
  }
  return [];
}

export function getTransientStatus(message: NeuraUIMessage | undefined): string | null {
  if (!message) {
    return null;
  }
  for (const part of [...message.parts].reverse()) {
    if (part.type === "data-status" && typeof part.data === "string") {
      return part.data;
    }
  }
  return null;
}
