export type ChatHistoryDto = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type SourceFilter = 'all' | 'cv' | 'github';

export type ChatRequestDto = {
  /** Simple client payload */
  message?: string;
  history?: ChatHistoryDto[];
  sourceFilter?: SourceFilter;
  /** Browser-visit session CV (lost on refresh) */
  sessionId?: string;
  /**
   * AI SDK useChat payload (Milestone 4).
   * Last user message is used as the question.
   */
  messages?: Array<{
    role: string;
    content?: string;
    parts?: Array<{ type: string; text?: string }>;
  }>;
};

export function normalizeSourceFilter(value: unknown): SourceFilter {
  if (value === 'cv' || value === 'github' || value === 'all') {
    return value;
  }
  return 'all';
}

export function extractChatQuestion(body: ChatRequestDto): {
  message: string;
  history: ChatHistoryDto[];
  sourceFilter: SourceFilter;
  sessionId?: string;
} {
  const sourceFilter = normalizeSourceFilter(body.sourceFilter);
  const sessionId = body.sessionId?.trim() || undefined;

  if (body.message?.trim()) {
    return {
      message: body.message.trim(),
      history: body.history ?? [],
      sourceFilter,
      sessionId,
    };
  }

  const messages = body.messages ?? [];
  const history: ChatHistoryDto[] = [];

  for (const msg of messages) {
    const content =
      typeof msg.content === 'string' && msg.content.trim()
        ? msg.content
        : (msg.parts ?? [])
            .filter((part) => part.type === 'text' && part.text)
            .map((part) => part.text!)
            .join('\n')
            .trim();

    if (!content) {
      continue;
    }

    if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system') {
      history.push({ role: msg.role, content });
    }
  }

  const lastUser = [...history].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    throw new Error('Request must include `message` or `messages` with a user turn');
  }

  return {
    message: lastUser.content,
    history: history.filter((m) => m !== lastUser),
    sourceFilter,
    sessionId,
  };
}
