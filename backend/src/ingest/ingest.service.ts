import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PDFParse } from 'pdf-parse';
import { EmbeddingsService } from '../chat/embeddings.service.js';
import { DatabaseService } from '../database/database.service.js';
import { chunkText } from './text-chunker.js';

type IngestDocument = {
  content: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);

  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(EmbeddingsService) private readonly embeddings: EmbeddingsService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async run(): Promise<{ inserted: number }> {
    const documents: IngestDocument[] = [];

    const cvDocs = await this.loadCvDocuments();
    documents.push(...cvDocs);

    const githubDocs = await this.loadGithubDocuments();
    documents.push(...githubDocs);

    if (documents.length === 0) {
      this.logger.warn(
        'Nothing to ingest. Add backend/data/CV.pdf and/or set GITHUB_USERNAME.',
      );
      return { inserted: 0 };
    }

    await this.database.query(
      `delete from documents
       where metadata->>'source' in ('CV.pdf', 'github')
          or metadata->>'source' like 'github:%'`,
    );

    return { inserted: await this.insertDocuments(documents) };
  }

  async ingestCvBuffer(buffer: Buffer): Promise<{ inserted: number }> {
    const cvPath = this.cvPath();
    await mkdir(dirname(cvPath), { recursive: true });
    await writeFile(cvPath, buffer);

    const documents = await this.documentsFromCvBuffer(buffer);
    await this.database.query(
      `delete from documents where metadata->>'type' = 'cv'`,
    );
    const inserted = await this.insertDocuments(documents);
    return { inserted };
  }

  private async insertDocuments(documents: IngestDocument[]): Promise<number> {
    let inserted = 0;
    for (const doc of documents) {
      const embedding = await this.embeddings.embed(doc.content);
      const vector = this.embeddings.toPgVector(embedding);

      await this.database.query(
        `insert into documents (content, metadata, embedding)
         values ($1, $2::jsonb, $3::vector)`,
        [doc.content, JSON.stringify(doc.metadata), vector],
      );
      inserted += 1;
      this.logger.log(
        `Inserted chunk ${inserted}/${documents.length} (${String(doc.metadata.source)})`,
      );
    }
    return inserted;
  }

  private cvPath(): string {
    return (
      this.config.get<string>('CV_PATH') ??
      resolve(process.cwd(), 'data', 'CV.pdf')
    );
  }

  private async loadCvDocuments(): Promise<IngestDocument[]> {
    try {
      const buffer = await readFile(this.cvPath());
      return this.documentsFromCvBuffer(buffer);
    } catch (error) {
      this.logger.warn(
        `Skipping CV ingest: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  private async documentsFromCvBuffer(
    buffer: Buffer,
  ): Promise<IngestDocument[]> {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    await parser.destroy();

    const chunks = chunkText(result.text);
    this.logger.log(`CV.pdf → ${chunks.length} chunks`);

    return chunks.map((content, index) => ({
      content,
      metadata: {
        source: 'CV.pdf',
        chunk: index,
        type: 'cv',
      },
    }));
  }

  private async loadGithubDocuments(): Promise<IngestDocument[]> {
    const username = this.config.get<string>('GITHUB_USERNAME');
    if (!username) {
      this.logger.warn('GITHUB_USERNAME not set — skipping GitHub ingest');
      return [];
    }

    const token = this.config.get<string>('GITHUB_TOKEN');
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'neura-folio-ingest',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const reposResponse = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&sort=updated`,
      { headers },
    );

    if (!reposResponse.ok) {
      throw new Error(
        `GitHub repos fetch failed: ${reposResponse.status} ${await reposResponse.text()}`,
      );
    }

    const repos = (await reposResponse.json()) as Array<{
      name: string;
      full_name: string;
      description: string | null;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      fork: boolean;
      topics?: string[];
    }>;

    const ownRepos = repos.filter((repo) => !repo.fork);
    const documents: IngestDocument[] = [];

    for (const repo of ownRepos) {
      const readme = await this.fetchReadme(repo.full_name, headers);
      const body = [
        `Repository: ${repo.full_name}`,
        `URL: ${repo.html_url}`,
        `Language: ${repo.language ?? 'n/a'}`,
        `Stars: ${repo.stargazers_count}`,
        `Description: ${repo.description ?? 'n/a'}`,
        `Topics: ${(repo.topics ?? []).join(', ') || 'n/a'}`,
        '',
        readme ?? '',
      ]
        .join('\n')
        .trim();

      const chunks = chunkText(body);
      for (const [index, content] of chunks.entries()) {
        documents.push({
          content,
          metadata: {
            source: `github:${repo.name}`,
            type: 'github',
            repo: repo.full_name,
            url: repo.html_url,
            chunk: index,
          },
        });
      }
    }

    this.logger.log(
      `GitHub (@${username}) → ${documents.length} chunks from ${ownRepos.length} repos`,
    );
    return documents;
  }

  private async fetchReadme(
    fullName: string,
    headers: Record<string, string>,
  ): Promise<string | null> {
    const response = await fetch(
      `https://api.github.com/repos/${fullName}/readme`,
      {
        headers: {
          ...headers,
          Accept: 'application/vnd.github.raw+json',
        },
      },
    );

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      this.logger.warn(
        `README fetch failed for ${fullName}: ${response.status}`,
      );
      return null;
    }

    return response.text();
  }
}
