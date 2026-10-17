import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import type { JwtPayload } from '../common/types.js';
import type { AppConfiguration } from '../config/configuration.js';
import { User } from '../database/entities/user.entity.js';
import { expiredSessionError, invalidCredentialsError } from './auth.errors.js';
import type { LoginDto } from './dto/login.dto.js';
import { toUserProfile, type UserProfile } from './user.mapper.js';

export interface LoginResult {
  readonly accessToken: string;
  readonly user: UserProfile;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly dummyHash: string;

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.dummyHash = bcrypt.hashSync(
      'argus-dummy-password-for-timing',
      config.auth.bcryptRounds,
    );
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userRepository
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.username = :username', { username: dto.username })
      .getOne();

    const passwordOk = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (user === null || !user.aktif || !passwordOk) {
      this.logger.warn(`login ditolak untuk username=${dto.username}`);
      throw invalidCredentialsError();
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      sppgId: user.sppgId,
      facilityId: user.facilityId,
    };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toUserProfile(user),
    };
  }

  async me(userId: string): Promise<UserProfile> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (user === null || !user.aktif) throw expiredSessionError();
    return toUserProfile(user);
  }
}
