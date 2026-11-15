import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { RagService } from '../chat/rag.service.js';

type EvalQuestion = {
  id: string;
  question: string;
  expectSourceContains: string[];
};

async function main() {
  const questionsPath = resolve(process.cwd(), '../evals/questions.json');
  const questions = JSON.parse(
    await readFile(questionsPath, 'utf8'),
  ) as EvalQuestion[];

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const rag = app.get(RagService);
    let passed = 0;

    for (const item of questions) {
      const { sources } = await rag.getContext(item.question);
      const labels = sources.map(
        (source) =>
          (source.metadata?.source as string | undefined) ??
          `document-${source.id}`,
      );
      const ok = item.expectSourceContains.some((needle) =>
        labels.some((label) => label.includes(needle)),
      );

      if (ok) {
        passed += 1;
        console.log(`PASS ${item.id} → ${labels.join(', ') || '(none)'}`);
      } else {
        console.log(
          `FAIL ${item.id} → expected one of [${item.expectSourceContains.join(', ')}], got [${labels.join(', ') || 'none'}]`,
        );
      }
    }

    console.log(`\nEval: ${passed}/${questions.length} passed`);
    if (passed < questions.length) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
