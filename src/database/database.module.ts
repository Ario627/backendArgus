import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { AppConfiguration } from '../config/configuration.js';
import { registerPgTypeParsers } from './pg-type-parsers.js';

registerPgTypeParsers();

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfiguration>('app');
        return {
          type: 'postgres' as const,
          host: config.database.host,
          port: config.database.port,
          database: config.database.name,
          username: config.database.user,
          password: config.database.password,
          ssl: config.database.ssl ? { rejectUnauthorized: true } : false,
          poolSize: config.database.poolSize,
          applicationName: 'argus-backend',
          autoLoadEntities: true,
          synchronize: false,
          migrationsRun: false,
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
