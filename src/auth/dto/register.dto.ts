import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { UserRole } from 'src/common/types';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  readonly username!: string;

  @IsString()
  @MinLength(8)
  readonly password!: string;

  @IsEnum(['admin', 'supervisor', 'driver'] as const)
  readonly role!: UserRole;

  @IsString()
  @IsOptional()
  readonly fleetId?: string;
}
