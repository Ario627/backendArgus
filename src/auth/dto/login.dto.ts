import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

const normalizeUsername = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(normalizeUsername)
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z0-9._-]+$/)
  readonly username!: string;

  @IsString()
  @Length(1, 72)
  readonly password!: string;
}
