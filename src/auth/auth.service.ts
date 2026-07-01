import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UserEntity } from "src/database/entities/user.entity";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "src/common/types";
import { RegisterDto } from "./dto/register.dto";

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(UserEntity)
        private readonly userRepo: Repository<UserEntity>,
        private readonly jwtService: JwtService,
    ) {}

    async login(dto: LoginDto): Promise<{accessToken: string}> {
        const user = await this.userRepo.findOne({
          where: { username: dto.username },
          select: {
            id: true,
            username: true,
            passwordHash: true,
            role: true,
            fleetId: true,
          },
        });

        if(!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
            throw new UnauthorizedException('Invalid username or password');
        }

        return {accessToken: this.signJwt(user)};
    }

    async register(dto: RegisterDto): Promise<{accessToken: string}> {
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const user = this.userRepo.create({
            username: dto.username,
            passwordHash,
            role: dto.role,
            fleetId: dto.fleetId ?? null,
        });

        await this.userRepo.save(user);
        return {accessToken: this.signJwt(user)};
    }

    private signJwt(user: Pick<UserEntity, 'id' | 'username' | 'role' | 'fleetId'>): string {
        const payload: JwtPayload = {
            sub: user.id,
            username: user.username,
            role: user.role,
            fleetId: user.fleetId
        };
        return this.jwtService.sign(payload);
    }
}