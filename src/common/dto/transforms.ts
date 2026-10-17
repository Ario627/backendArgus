export const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export const trimToNull = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const parseOptionalBoolean = ({
  value,
}: {
  value: unknown;
}): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};
