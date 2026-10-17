import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcceptanceProfile } from '../database/entities/acceptance-profile.entity.js';
import { Facility } from '../database/entities/facility.entity.js';
import { AcceptanceProfileService } from './acceptance-profile.service.js';
import { FacilityController } from './facility.controller.js';
import { FacilityService } from './facility.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Facility, AcceptanceProfile])],
  controllers: [FacilityController],
  providers: [FacilityService, AcceptanceProfileService],
  exports: [FacilityService, AcceptanceProfileService],
})
export class FacilityModule {}