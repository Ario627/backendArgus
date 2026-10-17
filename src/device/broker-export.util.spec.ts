import { describe, expect, it } from '@jest/globals';
import { buildBrokerExport, type BrokerDeviceRow } from './broker-export.util.js';

const FLEET = '0192f0a0-1111-7777-8888-999999999999';
const SCALE = '0192f0b1-0000-7000-8000-00000000b101';

const row = (overrides: Partial<BrokerDeviceRow>): BrokerDeviceRow => ({
  id: SCALE,
  tipe: 'timbangan',
  fleetId: null,
  mqttUsername: 'dev_ab12cd34',
  mqttPasswordHash: '$7$1000$c2FsdA==$aGFzaA==',
  ...overrides,
});

describe('buildBrokerExport', () => {
  it('menulis baris passwd dan blok acl backend + perangkat', () => {
    const files = buildBrokerExport([row({})], 'argus-backend');
    expect(files.passwd).toBe('dev_ab12cd34:$7$1000$c2FsdA==$aGFzaA==\n');
    expect(files.acl).toContain('user argus-backend');
    expect(files.acl).toContain('topic read fleet/+/telemetry');
    expect(files.acl).toContain('topic read scale/+/weight');
    expect(files.acl).toContain(`topic write scale/${SCALE}/weight`);
    expect(files.skippedAcl).toHaveLength(0);
  });

  it('memberi tracker akses tulis hanya ke topik armadanya', () => {
    const files = buildBrokerExport(
      [
        row({
          id: 'x',
          tipe: 'tracker',
          fleetId: FLEET,
          mqttUsername: 'dev_00000001',
        }),
      ],
      'argus-backend',
    );
    expect(files.acl).toContain(`topic write fleet/${FLEET}/telemetry`);
    expect(files.acl).not.toContain('topic write scale/');
  });

  it('melewati tracker tanpa fleet dan username tidak sah, tanpa memblokir sisanya', () => {
    const files = buildBrokerExport(
      [
        row({
          id: 'x',
          tipe: 'tracker',
          fleetId: null,
          mqttUsername: 'dev_00000002',
        }),
        row({ mqttUsername: 'Dev_Buruk' }),
        row({ id: 'y', mqttUsername: 'dev_00000003' }),
      ],
      'argus-backend',
    );
    expect(files.skippedAcl).toEqual(['dev_00000002', 'Dev_Buruk']);
    expect(files.passwd).toContain('dev_00000002');
    expect(files.passwd).not.toContain('Dev_Buruk');
    expect(files.acl).toContain('topic write scale/y/weight');
  });
});