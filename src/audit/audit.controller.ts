import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { PaginatedItems } from '../common/types.js';
import { AuditService } from './audit.service.js';
import type { AuditLogDto } from './audit.mapper.js';
import { AuditListQueryDto } from './dto/audit-list-query.dto.js';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('admin')
  async list(
    @Query() query: AuditListQueryDto,
  ): Promise<PaginatedItems<AuditLogDto>> {
    return this.auditService.list(query);
  }
}