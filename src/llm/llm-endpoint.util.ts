export const PROVIDER_BASE_URLS: Readonly<Record<string, string>> = Object.freeze({
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openrouter: 'https://openrouter.ai/api/v1',
  ollama: 'http://127.0.0.1:11434/v1',
  opencode: 'https://opencode.ai/zen/go/v1',
});

export type LlmEndpointError =
  'LLM_PROVIDER_UNKNOWN' | 'LLM_BASE_URL_INVALID' | 'LLM_BASE_URL_INSECURE';

export type LlmEndpointResolution =
  | { readonly ok: true; readonly baseUrl: string }
  | { readonly ok: false; readonly error: LlmEndpointError };

const stripTrailingSlash = (value: string): string =>
  value.endsWith('/') ? value.slice(0, -1) : value;

const parseUrl = (value: string): URL | null => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isPrivateHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0'
  ) {
    return true;
  }
  return (
    /^10\./.test(normalized) ||
    /^192\.168\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    /^169\.254\./.test(normalized)
  );
};

export const resolveLlmEndpoint = (input: {
  readonly provider: string | null;
  readonly baseUrl: string | null;
  readonly isProduction: boolean;
}): LlmEndpointResolution => {
  const raw =
    input.baseUrl ??
    (input.provider === null
      ? null
      : (PROVIDER_BASE_URLS[input.provider.toLowerCase()] ?? null));
  if (raw === null) {
    return { ok: false, error: 'LLM_PROVIDER_UNKNOWN' };
  }
  const parsed = parseUrl(raw);
  if (parsed === null) {
    return { ok: false, error: 'LLM_BASE_URL_INVALID' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, error: 'LLM_BASE_URL_INVALID' };
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    return { ok: false, error: 'LLM_BASE_URL_INVALID' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, error: 'LLM_BASE_URL_INVALID' };
  }
  if (
    input.isProduction &&
    (parsed.protocol !== 'https:' || isPrivateHost(parsed.hostname))
  ) {
    return { ok: false, error: 'LLM_BASE_URL_INSECURE' };
  }
  return {
    ok: true,
    baseUrl: stripTrailingSlash(`${parsed.origin}${parsed.pathname}`),
  };
};

export const chatCompletionsUrl = (baseUrl: string): string =>
  `${baseUrl}/chat/completions`;