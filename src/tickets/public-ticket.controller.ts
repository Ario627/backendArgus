import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator.js';
import { Throttle } from '@nestjs/throttler';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import {
  PublicPhotoService,
  type PublicPhotoResult,
} from './public-photo.service.js';
import {
  PublicTicketService,
  type PublicTicketResult,
} from './public-ticket.service.js';
import type { PublicSppgDto } from './ticket.mapper.js';

const SPPG_INFO_LIMIT = 60;
const SPPG_INFO_WINDOW_MS = 60000;
const TICKET_FLOOD_LIMIT = 30;
const TICKET_FLOOD_WINDOW_MS = 600000;
const PHOTO_LIMIT = 10;
const PHOTO_WINDOW_MS = 3600000;

@Controller('public')
export class PublicTicketController {
  constructor(
    private readonly publicTicketService: PublicTicketService,
    private readonly publicPhotoService: PublicPhotoService,
  ) {}

  @Get('sppg/:slug')
  @Public()
  @Throttle({ default: { limit: SPPG_INFO_LIMIT, ttl: SPPG_INFO_WINDOW_MS } })
  async sppgInfo(@Param('slug') slug: string): Promise<PublicSppgDto> {
    return this.publicTicketService.getPublicSppg(slug);
  }

  @Post('tickets')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({
    default: { limit: TICKET_FLOOD_LIMIT, ttl: TICKET_FLOOD_WINDOW_MS },
  })
  async createTicket(
    @Body() dto: CreateTicketDto,
    @Req() request: Request,
  ): Promise<PublicTicketResult> {
    return this.publicTicketService.createTicket(dto, request.ip ?? 'unknown');
  }

  @Post('photos')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: PHOTO_LIMIT, ttl: PHOTO_WINDOW_MS } })
  @UseInterceptors(FileInterceptor('foto'))
  async uploadPhoto(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<PublicPhotoResult> {
    return this.publicPhotoService.upload(file);
  }
}