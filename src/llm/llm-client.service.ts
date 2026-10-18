import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration.js';
import { LlmRequestError } from './llm.errors.js';
import {
  chatCompletionsUrl,
  resolveLlmEndpoint,
  type LlmEndpointError,
} from './llm-endpoint.util.js';
import type { ChatMessage } from './narrative-prompt.util.js';

const MAX_RESPONSE_CHARS = 4000;

interface CompletionUsage {
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
}

interface CompletionChoice {
  readonly message?: { readonly content?: unknown };
}

interface CompletionBody {
  readonly choices?: readonly CompletionChoice[];
  readonly usage?: CompletionUsage;
}

export interface LlmCompletion {
  readonly text: string;
  readonly model: string;
  readonly promptTokens: number | null;
  readonly completionTokens: number | null;
}

export type LlmAvailability =
  | { readonly enabled: true; readonly model: string }
  | {
      readonly enabled: false;
      readonly reason: LlmEndpointError | 'LLM_NOT_CONFIGURED';
    };

const readChoices = (body: unknown): readonly CompletionChoice[] => {
  if (body === null || typeof body !== 'object') return [];
  const choices = (body as CompletionBody).choices;
  return Array.isArray(choices) ? (choices as readonly CompletionChoice[]) : [];
};

const readCompletionText = (body: unknown): string | null => {
  const [first] = readChoices(body);
  const content = first?.message?.content;
  return typeof content === 'string' && content.trim().length > 0
    ? content.trim().slice(0, MAX_RESPONSE_CHARS)
    : null;
};

@Injectable()
export class LlmClientService {
  private readonly logger = new Logger(LlmClientService.name);
  private readonly apiKey: string | null;
  private readonly model: string | null;
  private readonly endpoint: string | null;
  private readonly availability: LlmAvailability;
  private readonly timeoutMs: number;
  private readonly maxOutputTokens: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    const resolution = resolveLlmEndpoint({
      provider: config.llm.provider,
      baseUrl: config.llm.baseUrl,
      isProduction: config.isProduction,
    });
    this.apiKey = config.llm.apiKey;
    this.model = config.llm.model;
    this.timeoutMs = config.llm.timeoutMs;
    this.maxOutputTokens = config.llm.maxOutputTokens;
    if (this.apiKey === null || this.model === null) {
      this.endpoint = null;
      this.availability = { enabled: false, reason: 'LLM_NOT_CONFIGURED' };
      return;
    }
    if (!resolution.ok) {
      this.endpoint = null;
      this.availability = { enabled: false, reason: resolution.error };
      return;
    }
    this.endpoint = chatCompletionsUrl(resolution.baseUrl);
    this.availability = { enabled: true, model: this.model };
  }

  get status(): LlmAvailability {
    return this.availability;
  }

  async complete(messages: readonly ChatMessage[]): Promise<LlmCompletion> {
    if (
      !this.availability.enabled ||
      this.endpoint === null ||
      this.model === null
    ) {
      throw new LlmRequestError('HTTP', null);
    }
    let response: Response;
    try {
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey ?? ''}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          max_tokens: this.maxOutputTokens,
          stream: false,
          n: 1,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      throw new LlmRequestError(
        name === 'TimeoutError' || name === 'AbortError' ? 'TIMEOUT' : 'HTTP',
        null,
      );
    }
    if (!response.ok) {
      this.logger.warn(`penyedia LLM menolak: status=${response.status}`);
      throw new LlmRequestError('HTTP', response.status);
    }
    let body: unknown;
    try {
      body = (await response.json()) as unknown;
    } catch {
      throw new LlmRequestError('PARSE', response.status);
    }
    const text = readCompletionText(body);
    if (text === null) {
      throw new LlmRequestError('EMPTY', response.status);
    }
    const usage = (body as CompletionBody).usage;
    return Object.freeze({
      text,
      model: this.model,
      promptTokens:
        typeof usage?.prompt_tokens === 'number' ? usage.prompt_tokens : null,
      completionTokens:
        typeof usage?.completion_tokens === 'number'
          ? usage.completion_tokens
          : null,
    });
  }
}