import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RawResponse } from '../common/decorators/raw-response.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import { ExportBatchesQueryDto } from './dto/export-batches-query.dto.js';
import { ExportService } from './export.service.js';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('batches.csv')
  @Roles('admin', 'dlh_auditor')
  @RawResponse()
  async batchesCsv(
    @Query() query: ExportBatchesQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<string> {
    const result = await this.exportService.batchesCsv(
      query,
      actor,
      request.requestId ?? null,
    );
    response.setHeader('Content-Type', CSV_CONTENT_TYPE);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Export-Rows', String(result.rowCount));
    response.setHeader(
      'X-Export-Truncated',
      result.truncated ? 'true' : 'false',
    );
    response.setHeader(
      'X-Export-Quota-Remaining',
      String(result.quotaRemaining),
    );
    return result.csv;
  }
}
