export const parseJsonObject = (
  payload: Buffer,
): Record<string, unknown> | null => {
  try {
    const parsed: unknown = JSON.parse(payload.toString('utf8'));
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};