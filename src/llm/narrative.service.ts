import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../common/types.js';
import { canonicalJson, sha256Hex } from '../common/utils/hash.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { LlmClientService } from './llm-client.service.js';
import {
  NARRATIVE_PROMPT_VERSION,
  type NarrativeFacts,
  type NarrativeGenerationInput,
  type NarrativeView,
} from './llm.types.js';
import { narrativeRateLimitedError } from './llm.errors.js';
import { NarrativeCacheService } from './narrative-cache.service.js';
import { buildNarrativeMessages } from './narrative-prompt.util.js';
import { sanitizeNarrative } from './pii-sanitizer.util.js';

export const NARRATIVE_QUOTA_ACTION = 'narrative.generate';
const NARRATIVE_QUOTA_WINDOW_HOURS = 24;

interface NarrativeConfigSnapshot {
  readonly ttlMinutes: number;
  readonly dailyLimit: number;
  readonly maxChars: number;
  readonly retryAfterSeconds: number;
}

const narrativeCacheKey = (facts: NarrativeFacts, model: string): string =>
  sha256Hex(
    canonicalJson({
      versi: NARRATIVE_PROMPT_VERSION,
      model,
      facts,
    }),
  );

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);
  private readonly config: NarrativeConfigSnapshot;
  private readonly inFlight = new Set<string>();

  constructor(
    configService: ConfigService,
    private readonly llmClient: LlmClientService,
    private readonly cacheService: NarrativeCacheService,
    private readonly auditService: AuditService,
  ) {
    const app = configService.getOrThrow<AppConfiguration>('app');
    this.config = Object.freeze({
      ttlMinutes: app.narrative.ttlMinutes,
      dailyLimit: app.narrative.dailyLimit,
      maxChars: app.narrative.maxChars,
      retryAfterSeconds: app.narrative.retryAfterSeconds,
    });
  }

  async request(
    facts: NarrativeFacts,
    actor: AuthenticatedUser,
    refresh: boolean,
    sppgId: string | null,
  ): Promise<NarrativeView> {
    const availability = this.llmClient.status;
    if (!availability.enabled) {
      return Object.freeze({
        status: 'DISABLED',
        narasi: null,
        model: null,
        generatedAt: null,
        expiresAt: null,
        retryAfterSeconds: null,
        reason: availability.reason,
      });
    }
    const cacheKey = narrativeCacheKey(facts, availability.model);
    if (!refresh) {
      const cached = await this.cacheService.findFresh(cacheKey);
      if (cached !== null) {
        return Object.freeze({
          status: 'READY',
          narasi: cached.narasi,
          model: cached.model,
          generatedAt: cached.created_at.toISOString(),
          expiresAt: cached.expires_at.toISOString(),
          retryAfterSeconds: null,
          reason: null,
        });
      }
    }
    if (this.inFlight.has(cacheKey)) {
      return this.pending();
    }
    const quota = await this.auditService.consumeQuota({
      aktor: actor.id,
      aktorPeran: actor.role,
      aksi: NARRATIVE_QUOTA_ACTION,
      limitPerDay: this.config.dailyLimit,
      windowHours: NARRATIVE_QUOTA_WINDOW_HOURS,
      entitas: 'narasi_dashboard',
      detail: { tanggal: facts.tanggal, cakupan: facts.cakupan },
      requestId: null,
    });
    if (!quota.allowed) {
      throw narrativeRateLimitedError(this.config.dailyLimit);
    }
    this.startGeneration({ cacheKey, facts }, sppgId);
    return this.pending();
  }

  private pending(): NarrativeView {
    return Object.freeze({
      status: 'PENDING',
      narasi: null,
      model: null,
      generatedAt: null,
      expiresAt: null,
      retryAfterSeconds: this.config.retryAfterSeconds,
      reason: null,
    });
  }

  private startGeneration(
    input: NarrativeGenerationInput,
    sppgId: string | null,
  ): void {
    if (this.inFlight.has(input.cacheKey)) return;
    this.inFlight.add(input.cacheKey);
    void this.generate(input, sppgId)
      .catch((error: unknown) => {
        this.logger.warn(
          `narasi gagal dibuat: ${error instanceof Error ? error.message : 'non-error'}`,
        );
      })
      .finally(() => {
        this.inFlight.delete(input.cacheKey);
      });
  }

  private async generate(
    input: NarrativeGenerationInput,
    sppgId: string | null,
  ): Promise<void> {
    const startedAt = Date.now();
    const completion = await this.llmClient.complete(
      buildNarrativeMessages(input.facts),
    );
    const sanitized = sanitizeNarrative(completion.text, this.config.maxChars);
    if (sanitized.text.length < 20) {
      throw new Error('NARRATIVE_TOO_SHORT');
    }
    await this.cacheService.save({
      cacheKey: input.cacheKey,
      sppgId,
      tanggal: input.facts.tanggal,
      model: completion.model,
      narasi: sanitized.text,
      promptTokens: completion.promptTokens,
      completionTokens: completion.completionTokens,
      ttlMinutes: this.config.ttlMinutes,
    });
    await this.auditService.record({
      aktor: null,
      aktorPeran: null,
      aksi: 'narrative.ready',
      entitas: 'narasi_dashboard',
      entitasId: null,
      detail: {
        model: completion.model,
        chars: sanitized.text.length,
        redactions: sanitized.redactions,
        durationMs: Date.now() - startedAt,
      },
      requestId: null,
    });
  }
}