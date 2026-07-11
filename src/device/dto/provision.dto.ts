import { IsNotEmpty, IsString } from 'class-validator';

export class ProvisionDto {
  @IsString()
  @IsNotEmpty()
  readonly token!: string;
}

export class GenerateTokenDto {
  @IsString()
  @IsNotEmpty()
  readonly deviceId!: string;

  @IsString()
  @IsNotEmpty()
  readonly fleetId!: string;
}