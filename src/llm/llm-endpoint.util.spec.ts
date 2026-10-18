import { describe, expect, it } from '@jest/globals';
import {
  chatCompletionsUrl,
  PROVIDER_BASE_URLS,
  resolveLlmEndpoint,
} from './llm-endpoint.util.js';

const resolve = (input: {
  provider?: string | null;
  baseUrl?: string | null;
  isProduction?: boolean;
}) =>
  resolveLlmEndpoint({
    provider: input.provider ?? null,
    baseUrl: input.baseUrl ?? null,
    isProduction: input.isProduction ?? false,
  });

describe('resolveLlmEndpoint', () => {
  it('memakai URL bawaan untuk provider yang dikenal', () => {
    expect(resolve({ provider: 'groq' })).toEqual({
      ok: true,
      baseUrl: PROVIDER_BASE_URLS.groq,
    });
    expect(resolve({ provider: 'GROQ' })).toEqual({
      ok: true,
      baseUrl: PROVIDER_BASE_URLS.groq,
    });
  });

  it('menolak provider tanpa URL dan tanpa base URL', () => {
    expect(resolve({ provider: null })).toEqual({
      ok: false,
      error: 'LLM_PROVIDER_UNKNOWN',
    });
    expect(resolve({ provider: 'entah' })).toEqual({
      ok: false,
      error: 'LLM_PROVIDER_UNKNOWN',
    });
  });

  it('merapikan base URL kustom dan membuang garis miring akhir', () => {
    expect(resolve({ baseUrl: 'https://llm.internal/v1/' })).toEqual({
      ok: true,
      baseUrl: 'https://llm.internal/v1',
    });
  });

  it('menolak URL dengan kredensial, query, atau skema aneh', () => {
    const invalid = [
      'https://user:pass@llm.internal/v1',
      'https://llm.internal/v1?token=x',
      'https://llm.internal/v1#frag',
      'file:///etc/passwd',
      'bukan-url',
    ];
    for (const baseUrl of invalid) {
      expect(resolve({ baseUrl })).toEqual({
        ok: false,
        error: 'LLM_BASE_URL_INVALID',
      });
    }
  });

  it('mewajibkan https dan host publik di produksi', () => {
    expect(
      resolve({ baseUrl: 'http://llm.internal/v1', isProduction: true }),
    ).toEqual({
      ok: false,
      error: 'LLM_BASE_URL_INSECURE',
    });
    expect(
      resolve({ baseUrl: 'https://10.0.0.5/v1', isProduction: true }),
    ).toEqual({ ok: false, error: 'LLM_BASE_URL_INSECURE' });
    expect(
      resolve({ baseUrl: 'https://llm.internal/v1', isProduction: true }),
    ).toEqual({ ok: true, baseUrl: 'https://llm.internal/v1' });
  });

  it('membiarkan ollama lokal saat pengembangan', () => {
    expect(resolve({ provider: 'ollama' })).toEqual({
      ok: true,
      baseUrl: PROVIDER_BASE_URLS.ollama,
    });
  });
});

describe('chatCompletionsUrl', () => {
  it('menambahkan path chat completions', () => {
    expect(chatCompletionsUrl('https://api.groq.com/openai/v1')).toBe(
      'https://api.groq.com/openai/v1/chat/completions',
    );
  });
});