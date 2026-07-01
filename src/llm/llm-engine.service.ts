import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { RouteResult, RecoveryResult } from 'src/common/types';

const PII_KEYS = ['driverName', 'driverContact', 'username'] as const;

@Injectable()
export class LlmEngineService {
  private readonly logger = new Logger(LlmEngineService.name);
  private readonly apiKey: string;
  private readonly url: string;
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    const llm = config.get<{
      apiKey: string;
      url: string;
      model: string;
      timeoutMs: number;
    }>('app.llm')!;
    this.apiKey = llm.apiKey;
    this.url = llm.url;
    this.model = llm.model;
    this.timeoutMs = llm.timeoutMs;
  }

  async summarizeRoutePlan(
    routes: readonly RouteResult[],
  ): Promise<string | null> {
    if (!routes.length) return null;
    const prompt = `Ringkas rute harian: ${JSON.stringify(this.sanitize(routes))}. Beri insight singkat (max 200 kata).`;
    return this.callLlm(prompt);
  }

  async summarizeRecovery(result: RecoveryResult): Promise<string | null> {
    const prompt = `Ringkas swarm recovery: ${JSON.stringify(this.sanitize(result))}. Jelaskan redistribusi & status (max 200 kata).`;
    return this.callLlm(prompt);
  }

  private async callLlm(prompt: string): Promise<string | null> {
    if (!this.apiKey) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const { data } = await firstValueFrom(
        this.http.post(
          this.url,
          {
            model: this.model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 300,
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            signal: controller.signal,
          },
        ),
      );
      return data?.choices?.[0]?.message?.content ?? null;
    } catch (err) {
      this.logger.warn(`LLM call failed: ${this.redact(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private sanitize<T>(obj: T): T {
    return JSON.parse(
      JSON.stringify(obj, (key, value) =>
        PII_KEYS.includes(key as (typeof PII_KEYS)[number]) ? undefined : value,
      ),
    );
  }

  private redact(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err);
    return msg.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]');
  }
}
