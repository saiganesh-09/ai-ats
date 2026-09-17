import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { User } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  // Brute-force targets get 5/min instead of the global 100/min.
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto);
    return this.auth.issueTokens(user, res);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto.email, dto.password);
    return this.auth.issueTokens(user, res);
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req.cookies?.ats_rt, res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req.cookies?.ats_rt, res);
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.publicUser(user);
  }
}
