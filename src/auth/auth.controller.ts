import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../common/types.js';
import { AuthService, type LoginResult } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import type { UserProfile } from './user.mapper.js';

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 60000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @Throttle({ default: { limit: LOGIN_RATE_LIMIT, ttl: LOGIN_RATE_WINDOW_MS } })
  login(@Body() dto: LoginDto): Promise<LoginResult> {
    return this.authService.login(dto);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.authService.me(user.id);
  }
}
