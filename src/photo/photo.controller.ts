import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { hashParamPipe } from '../common/pipes/hash-param.pipe.js';
import type { AuthenticatedUser } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import { UploadPhotoDto } from './dto/upload-photo.dto.js';
import type { PhotoLinkDto, PhotoUploadDto } from './photo.mapper.js';
import { PhotoService } from './photo.service.js';

@Controller('photos')
export class PhotoController {
  private readonly maxBytes: number;

  constructor(
    private readonly photoService: PhotoService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.maxBytes = config.storage.photoMaxBytes;
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