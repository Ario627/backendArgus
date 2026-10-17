import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import type { AppConfiguration } from '../config/configuration.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { Photo } from '../database/entities/photo.entity.js';
import { Ticket } from '../database/entities/ticket.entity.js';
import { PhotoController } from './photo.controller.js';
import { PhotoService } from './photo.service.js';
import { StorageService } from './storage.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Photo, Batch, LedgerEvent, Ticket]),
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfiguration>('app');
        return {
          storage: memoryStorage(),
          limits: {
            fileSize: config.storage.photoMaxBytes,
            files: 1,
            fields: 10,
          },
        };
      },
    }),
  ],
  controllers: [PhotoController],
  providers: [PhotoService, StorageService],
  exports: [StorageService],
})
export class PhotoModule {}
