export function chunkText(
  text: string,
  options: { wordsPerChunk?: number; overlapWords?: number } = {},
): string[] {
  const wordsPerChunk = options.wordsPerChunk ?? 500;
  const overlapWords = options.overlapWords ?? 50;
  const words = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  if (words.length <= wordsPerChunk) {
    return [words.join(' ')];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    chunks.push(words.slice(start, end).join(' '));
    if (end === words.length) {
      break;
    }
    start = Math.max(end - overlapWords, start + 1);
  }

  return chunks;
}
