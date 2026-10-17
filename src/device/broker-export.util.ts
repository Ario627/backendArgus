import type { DeviceType } from '../common/constant/domain.constant.js';

const MQTT_USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export interface BrokerDeviceRow {
  readonly id: string;
  readonly tipe: DeviceType;
  readonly fleetId: string | null;
  readonly mqttUsername: string;
  readonly mqttPasswordHash: string;
}

export interface BrokerExportFiles {
  readonly passwd: string;
  readonly acl: string;
  readonly skippedAcl: readonly string[];
}

const topicForDevice = (row: BrokerDeviceRow): string | null => {
  if (row.tipe === 'tracker') {
    return row.fleetId === null ? null : `fleet/${row.fleetId}/telemetry`;
  }
  return `scale/${row.id}/weight`;
};

export const buildBrokerExport = (
  devices: readonly BrokerDeviceRow[],
  backendUsername: string,
): BrokerExportFiles => {
  const passwdLines: string[] = [];
  const aclBlocks: string[] = [
    `user ${backendUsername}`,
    'topic read fleet/+/telemetry',
    'topic read scale/+/weight',
    '',
  ];
  const skippedAcl: string[] = [];

  for (const row of devices) {
    if (!MQTT_USERNAME_PATTERN.test(row.mqttUsername)) {
      skippedAcl.push(row.mqttUsername);
      continue;
    }
    passwdLines.push(`${row.mqttUsername}:${row.mqttPasswordHash}`);
    const topic = topicForDevice(row);
    if (topic === null) {
      skippedAcl.push(row.mqttUsername);
      continue;
    }
    aclBlocks.push(`user ${row.mqttUsername}`, `topic write ${topic}`, '');
  }

  return Object.freeze({
    passwd: passwdLines.join('\n') + '\n',
    acl: aclBlocks.join('\n'),
    skippedAcl: Object.freeze(skippedAcl),
  });
};