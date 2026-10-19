import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { hashParamPipe } from '../common/pipes/hash-param.pipe.js';
import type { AuthenticatedUser } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import { UploadPhotoDto } from './dto/upload-photo.dto.js';
import type { PhotoLinkDto, PhotoUploadDto } from './photo.mapper.js';
import { PhotoService } from './photo.service.js';
import { StorageService } from './storage.service.js';

@Controller('photos')
export class PhotoController {
  private readonly maxBytes: number;

  constructor(
    private readonly photoService: PhotoService,
    private readonly storageService: StorageService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.maxBytes = config.storage.photoMaxBytes;
  }

  @Get('file/:sha256')
  @Public()
  async serveFile(
    @Param('sha256', hashParamPipe('sha256')) sha256: string,
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const expiresAt = exp === undefined ? Number.NaN : Number(exp);
    if (
      sig === undefined ||
      !this.storageService.verifySignature(sha256, expiresAt, sig)
    ) {
      response.status(403).json({
        success: false,
        error: {
          code: 'PHOTO_FORBIDDEN',
          message: 'Tautan foto tidak berlaku',
        },
      });
      return;
    }
    const file = await this.photoService.readFile(sha256);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', String(file.body.length));
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(file.body);
  }

  @Post()
  @Roles('sppg_staff', 'driver', 'facility', 'admin')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PhotoUploadDto> {
    return this.photoService.upload(file, dto, user, this.maxBytes);
  }

  @Get(':sha256')
  getUrl(
    @Param('sha256', hashParamPipe('sha256')) sha256: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PhotoLinkDto> {
    return this.photoService.getSignedUrl(sha256, user);
  }
}
