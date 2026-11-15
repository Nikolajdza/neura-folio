import { describe, expect, it } from 'vitest';
import { chunkText } from './text-chunker.js';

describe('chunkText', () => {
  it('returns empty array for blank input', () => {
    expect(chunkText('   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    expect(chunkText('hello world')).toEqual(['hello world']);
  });

  it('splits long text with overlap', () => {
    const words = Array.from({ length: 120 }, (_, i) => `w${i}`).join(' ');
    const chunks = chunkText(words, { wordsPerChunk: 50, overlapWords: 10 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].split(' ')).toHaveLength(50);
  });
});
