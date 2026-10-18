const REDACTION = '[disensor]';

const MARKUP_TAG = /<[^>\n]{1,200}>/g;
const PICTOGRAPH = /[\p{Extended_Pictographic}\uFE0F\u200D]/gu;
const CONTROL_CHARS = /[^\P{Cc}\n]/gu;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const URL = /\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi;
const NIK = /\b\d{16}\b/g;
const PHONE = /(?:\+62|62|0)8[1-9]\d{6,11}\b/g;
const COORDINATES = /-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/g;
const LONG_DIGITS = /\b\d{9,}\b/g;
const SPACES = /[ \t]{2,}/g;
const BLANK_LINES = /\n{3,}/g;

export interface RedactionResult {
  readonly text: string;
  readonly redactions: number;
}

export const stripMarkup = (input: string): string =>
  input
    .replace(MARKUP_TAG, ' ')
    .replace(PICTOGRAPH, '')
    .replace(CONTROL_CHARS, '')
    .replace(SPACES, ' ')
    .replace(BLANK_LINES, '\n\n');

export const redactSensitive = (input: string): RedactionResult => {
  let redactions = 0;
  const replaceAll = (pattern: RegExp): void => {
    const matches = input.match(pattern);
    if (matches === null) return;
    redactions += matches.length;
  };
  replaceAll(EMAIL);
  replaceAll(URL);
  replaceAll(NIK);
  replaceAll(PHONE);
  replaceAll(COORDINATES);
  replaceAll(LONG_DIGITS);
  const text = input
    .replace(EMAIL, REDACTION)
    .replace(URL, REDACTION)
    .replace(NIK, REDACTION)
    .replace(PHONE, REDACTION)
    .replace(COORDINATES, REDACTION)
    .replace(LONG_DIGITS, REDACTION);
  return Object.freeze({ text, redactions });
};

const clampSentences = (input: string, maxSentences: number): string => {
  const parts = input
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.slice(0, maxSentences).join(' ');
};

export const sanitizeNarrative = (
  input: string,
  maxChars: number,
): RedactionResult => {
  const stripped = stripMarkup(input);
  const redacted = redactSensitive(stripped);
  const clamped = clampSentences(redacted.text.replace(/\s+/g, ' ').trim(), 4);
  const text =
    clamped.length <= maxChars
      ? clamped
      : `${clamped.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
  return Object.freeze({ text, redactions: redacted.redactions });
};