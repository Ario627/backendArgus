import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import { User } from '../database/entities/user.entity.js';
import { expiredSessionError } from './auth.errors.js';
import { parseJwtPayload } from './jwt-payload.util.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.auth.jwtSecret,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: unknown): Promise<AuthenticatedUser> {
    const parsed = parseJwtPayload(payload);
    if (parsed === null) throw expiredSessionError();

    const user = await this.userRepository.findOne({
      where: { id: parsed.sub },
    });
    if (user === null || !user.aktif) throw expiredSessionError();

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      sppgId: user.sppgId,
      facilityId: user.facilityId,
      fleetId: user.fleetId,
    };
  }
}
