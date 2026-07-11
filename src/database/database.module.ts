import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FleetEntity } from './entities/fleet.entity';
import { DestinationEntity } from './entities/destination.entity';
import { TelemetryEntity } from './entities/telemetry.entity';
import { RoutePlanEntity } from './entities/route-plan.entity';
import { RecoveryLogEntity } from './entities/recovery-log.entity';
import { UserEntity } from './entities/user.entity';
import { DeviceEntity } from './entities/device.entity';
import { ProvisioningTokenEntity } from './entities/provisioning-token.entity';

const ENTITIES = [
  FleetEntity,
  DestinationEntity,
  TelemetryEntity,
  RoutePlanEntity,
  RecoveryLogEntity,
  UserEntity,
  DeviceEntity,
  ProvisioningTokenEntity,
];

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => {
                const db = config.get<{url: string; poolSize: number}>('app.database')!;
                return {
                    type: 'postgres',
                    url: db?.url,
                    entities: ENTITIES,
                    synchronize: false,
                    extra: {poolSize: db?.poolSize}
                };
            },
        }),
        TypeOrmModule.forFeature(ENTITIES),
    ],
    exports: [TypeOrmModule],
})
export class DatabaseModule {}