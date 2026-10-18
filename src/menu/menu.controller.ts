import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { CreateMenuItemDto } from './dto/create-menu-item.dto.js';
import { CreateObservationDto } from './dto/create-observation.dto.js';
import { CreateServingDto } from './dto/create-serving.dto.js';
import { MenuInsightQueryDto } from './dto/insight-query.dto.js';
import { MenuItemListQueryDto } from './dto/menu-list-query.dto.js';
import { ServingListQueryDto } from './dto/serving-list-query.dto.js';
import type {
  MenuItemDto,
  MenuServingDto,
  MenuServingListDto,
} from './menu.mapper.js';
import {
  MenuService,
  type MenuInsightReport,
  type ObservationResult,
} from './menu.service.js';

@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get('items')
  async listItems(
    @Query() query: MenuItemListQueryDto,
  ): Promise<PaginatedItems<MenuItemDto>> {
    return this.menuService.listItems(query);
  }

  @Get('servings')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async listServings(
    @Query() query: ServingListQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<PaginatedItems<MenuServingListDto>> {
    return this.menuService.listServings(query, actor);
  }

  @Post('items')
  @Roles('admin')
  async createItem(@Body() dto: CreateMenuItemDto): Promise<MenuItemDto> {
    return this.menuService.createItem(dto);
  }

  @Post('servings')
  @Roles('admin', 'sppg_staff')
  async createServing(
    @Body() dto: CreateServingDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MenuServingDto> {
    return this.menuService.createServing(dto, actor);
  }

  @Post('observations')
  @Roles('admin', 'sppg_staff')
  async createObservation(
    @Body() dto: CreateObservationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<ObservationResult> {
    return this.menuService.createObservation(dto, actor);
  }

  @Get('insights')
  @Roles('admin', 'dlh_auditor', 'sppg_staff')
  async insights(
    @Query() query: MenuInsightQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MenuInsightReport> {
    return this.menuService.insights(query, actor);
  }
}
