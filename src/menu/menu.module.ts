import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DistributionPoint } from '../database/entities/distribution-point.entity.js';
import { LeftoverObservation } from '../database/entities/leftover-observation.entity.js';
import { MenuItem } from '../database/entities/menu-item.entity.js';
import { MenuServing } from '../database/entities/menu-serving.entity.js';
import { MenuController } from './menu.controller.js';
import { MenuService } from './menu.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuItem,
      MenuServing,
      LeftoverObservation,
      DistributionPoint,
    ]),
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}