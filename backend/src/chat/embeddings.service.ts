import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MODEL = 'Xenova/bge-small-en-v1.5';
const EMBEDDING_DIM = 384;

type FeatureExtractor = (
  text: string,
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array | number[] }>;

@Injectable()
export class EmbeddingsService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly provider: 'local' | 'hf';
  private readonly hfToken: string;
  private readonly hfModel: string;
  private readonly localModel: string;
  private extractor: FeatureExtractor | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.provider =
      (this.config.get<string>('EMBEDDING_PROVIDER') as 'local' | 'hf') ??
      'local';
    this.hfToken = this.config.get<string>('HF_TOKEN') ?? '';
    this.hfModel =
      this.config.get<string>('HF_EMBEDDING_MODEL') ?? 'BAAI/bge-small-en-v1.5';
    this.localModel =
      this.config.get<string>('LOCAL_EMBEDDING_MODEL') ?? DEFAULT_MODEL;
  }

  async onModuleInit() {
    if (this.provider === 'local') {
      await this.loadLocalModel();
    }
  }

  async embed(text: string): Promise<number[]> {
    if (this.provider === 'hf') {
      return this.embedWithHuggingFace(text);
    }
    return this.embedLocal(text);
  }

  toPgVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  private async loadLocalModel() {
    this.logger.log(`Loading local embedding model: ${this.localModel}`);
    const { pipeline } = await import('@huggingface/transformers');
    this.extractor = (await pipeline(
      'feature-extraction',
      this.localModel,
    )) as FeatureExtractor;
    this.logger.log('Local embedding model ready');
  }

  private async embedLocal(text: string): Promise<number[]> {
    if (!this.extractor) {
      await this.loadLocalModel();
    }

    const output = await this.extractor!(text, {
      pooling: 'mean',
      normalize: true,
    });

    const vector = Array.from(output.data);
    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `Expected embedding dim ${EMBEDDING_DIM}, got ${vector.length}`,
      );
    }
    return vector;
  }

  private async embedWithHuggingFace(text: string): Promise<number[]> {
    if (!this.hfToken) {
      throw new Error('HF_TOKEN is not set');
    }

    const endpoint = `https://router.huggingface.co/hf-inference/models/${this.hfModel}/pipeline/feature-extraction`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: text,
        normalize: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`HF embeddings failed (${response.status}): ${body}`);
      throw new Error(`Hugging Face embeddings failed: ${response.status}`);
    }

    const data: unknown = await response.json();
    const vector = this.normalizeEmbedding(data);

    if (vector.length !== EMBEDDING_DIM) {
      throw new Error(
        `Expected embedding dim ${EMBEDDING_DIM}, got ${vector.length}`,
      );
    }

    return vector;
  }

  private normalizeEmbedding(data: unknown): number[] {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Unexpected embedding response shape');
    }

    if (typeof data[0] === 'number') {
      return data as number[];
    }

    if (Array.isArray(data[0]) && typeof data[0][0] === 'number') {
      return data[0] as number[];
    }

    if (
      Array.isArray(data[0]) &&
      Array.isArray(data[0][0]) &&
      typeof data[0][0][0] === 'number'
    ) {
      const tokens = data[0] as number[][];
      const dim = tokens[0].length;
      const pooled = new Array<number>(dim).fill(0);
      for (const token of tokens) {
        for (let i = 0; i < dim; i++) {
          pooled[i] += token[i];
        }
      }
      return pooled.map((v) => v / tokens.length);
    }

    throw new Error('Unexpected embedding response shape');
  }
}
