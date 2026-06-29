export enum OperationalStatus {
  ONLINE_NORMAL = 'ONLINE_NORMAL',
  ONLINE_BROKEN = 'ONLINE_BROKEN',
  STALE = 'STALE',
  OFFLINE = 'OFFLINE',
}

export enum HardwareStatus {
  NORMAL = 'normal',
  BROKEN = 'broken',
}

export const OPERATIONAL_STATUS_VALUES: readonly OperationalStatus[] =
  Object.freeze([
    OperationalStatus.ONLINE_NORMAL,
    OperationalStatus.ONLINE_BROKEN,
    OperationalStatus.STALE,
    OperationalStatus.OFFLINE,
  ]);

export const HARDWARE_STATUS_VALUES: readonly HardwareStatus[] = Object.freeze([
  HardwareStatus.NORMAL,
  HardwareStatus.BROKEN,
]);
