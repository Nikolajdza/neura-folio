import { describe, expect, it } from 'vitest';
import { extractChatQuestion } from './chat.dto.js';

describe('extractChatQuestion', () => {
  it('uses simple message + history', () => {
    expect(
      extractChatQuestion({
        message: 'Who are you?',
        history: [{ role: 'user', content: 'hi' }],
        sourceFilter: 'cv',
      }),
    ).toEqual({
      message: 'Who are you?',
      history: [{ role: 'user', content: 'hi' }],
      sourceFilter: 'cv',
      sessionId: undefined,
    });
  });

  it('extracts last user message from AI SDK messages', () => {
    const result = extractChatQuestion({
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi there' },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Show my projects' }],
        },
      ],
    });

    expect(result.message).toBe('Show my projects');
    expect(result.history).toHaveLength(2);
    expect(result.sourceFilter).toBe('all');
    expect(result.sessionId).toBeUndefined();
  });

  it('throws when no user message exists', () => {
    expect(() => extractChatQuestion({})).toThrow(/must include/);
  });
});
