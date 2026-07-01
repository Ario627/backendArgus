import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { Public } from "src/common/decorators/roles.decorator";

@Controller('auth')
export class AuthController{
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Post('login')
    @Throttle({default: {limit: 5, ttl: 60000}})
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Public()
    @Post('register')
    @Throttle({default: {limit: 5, ttl: 60000}})
    @HttpCode(HttpStatus.CREATED)
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }
}