import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @Matches(/^[A-Za-z0-9:_-]{3,64}$/, {
    message: 'deviceId must be 3-64 chars: alphanumeric, colon, hyphen, underscore',
  })
  readonly deviceId!: string;

  @IsString()
  @IsOptional()
  readonly secret?: string;
}