import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { memoryStorage } from 'multer';
import type { AppConfiguration } from '../config/configuration.js';
import { Photo } from '../database/entities/photo.entity.js';
import { Sppg } from '../database/entities/sppg.entity.js';
import { Ticket } from '../database/entities/ticket.entity.js';
import { TicketEvent } from '../database/entities/ticket-event.entity.js';
import { PhotoModule } from '../photo/photo.module.js';
import { PublicPhotoService } from './public-photo.service.js';
import { PublicTicketController } from './public-ticket.controller.js';
import { PublicTicketService } from './public-ticket.service.js';
import { TicketController } from './ticket.controller.js';
import { TicketService } from './ticket.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketEvent, Sppg, Photo]),
    PhotoModule,
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
  controllers: [PublicTicketController, TicketController],
  providers: [TicketService, PublicTicketService, PublicPhotoService],
  exports: [TicketService],
})
export class TicketModule {}