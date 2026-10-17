export const FLEET_KODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

export const normalizeFleetKode = (params: {
  readonly value: unknown;
}): unknown =>
  typeof params.value === 'string'
    ? params.value.trim().toUpperCase()
    : params.value;