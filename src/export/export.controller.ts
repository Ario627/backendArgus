import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { RawResponse } from '../common/decorators/raw-response.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import { ExportBatchesQueryDto } from './dto/export-batches-query.dto.js';
import { ExportService } from './export.service.js';

const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';
const PDF_CONTENT_TYPE = 'application/pdf';

const applyCommonHeaders = (
  response: Response,
  filename: string,
  contentType: string,
): void => {
  response.setHeader('Content-Type', contentType);
  response.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"`,
  );
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
};

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
    applyCommonHeaders(response, result.filename, CSV_CONTENT_TYPE);
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

  @Get('batches.pdf')
  @Roles('admin', 'dlh_auditor')
  @RawResponse()
  async batchesPdf(
    @Query() query: ExportBatchesQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.exportService.batchesPdf(
      query,
      actor,
      request.requestId ?? null,
    );
    applyCommonHeaders(response, result.filename, PDF_CONTENT_TYPE);
    response.setHeader('X-Export-Rows', String(result.rowCount));
    response.setHeader('X-Export-Pages', String(result.pageCount));
    response.setHeader(
      'X-Export-Truncated',
      result.truncated ? 'true' : 'false',
    );
    response.setHeader(
      'X-Export-Quota-Remaining',
      String(result.quotaRemaining),
    );
    response.end(Buffer.from(result.bytes));
  }
}
