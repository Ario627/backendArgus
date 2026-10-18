import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { NarrativeCacheEntity } from '../database/entities/narrative-cache.entity.js';
import { LlmClientService } from './llm-client.service.js';
import { NarrativeCacheService } from './narrative-cache.service.js';
import { NarrativeService } from './narrative.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([NarrativeCacheEntity]), AuditModule],
  providers: [LlmClientService, NarrativeCacheService, NarrativeService],
  exports: [LlmClientService, NarrativeService],
})
export class LlmModule {}