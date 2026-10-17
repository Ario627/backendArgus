import { Body, Controller, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { ListQueryDto } from '../common/dto/list-query.dto.js';
import { uuidParamPipe } from '../common/pipes/uuid-param.pipe.js';
import type { AuthenticatedUser, PaginatedItems } from '../common/types.js';
import { AcceptanceProfileService } from './acceptance-profile.service.js';
import { CreateFacilityDto } from './dto/create-facility.dto.js';
import { FacilityListQueryDto } from './dto/list-query.dto.js';
import { UpdateFacilityDto } from './dto/update-facility.dto.js';
import { FacilityService } from './facility.service.js';
import type { FacilityDto, ProfileDto } from './facility.mapper.js';

@Controller('facilities')
export class FacilityController {
  constructor(
    private readonly facilityService: FacilityService,
    private readonly profileService: AcceptanceProfileService,
  ) {}

  @Get()
  list(@Query() query: FacilityListQueryDto): Promise<PaginatedItems<FacilityDto>> {
    return this.facilityService.list(query);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateFacilityDto): Promise<FacilityDto> {
    return this.facilityService.create(dto);
  }

  @Patch(':id')
  @Roles('admin', 'facility')
  update(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() dto: UpdateFacilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FacilityDto> {
    return this.facilityService.update(id, dto, user);
  }

  @Get(':id/profile')
  getProfile(@Param('id', uuidParamPipe('id')) id: string): Promise<ProfileDto> {
    return this.profileService.getActive(id);
  }

  @Get(':id/profile/versions')
  @Roles('admin', 'dlh_auditor')
  listVersions(
    @Param('id', uuidParamPipe('id')) id: string,
    @Query() query: ListQueryDto,
  ): Promise<PaginatedItems<ProfileDto>> {
    return this.profileService.listVersions(id, query);
  }

  @Put(':id/profile')
  @Roles('admin', 'facility')
  putProfile(
    @Param('id', uuidParamPipe('id')) id: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfileDto> {
    return this.profileService.createVersion(id, body, user);
  }
}