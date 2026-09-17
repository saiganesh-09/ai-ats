import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import type { Response } from 'express';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';

const REFRESH_COOKIE = 'ats_rt';
const REFRESH_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS ?? 30);

/**
 * Auth model: short-lived JWT access token (returned in body, stored in
 * memory/localStorage by the client) + long-lived refresh token (httpOnly
 * cookie). Refresh tokens are ROTATED: every use revokes the old one and
 * issues a new one, so a stolen token can only be used once.
 * We persist sha256(refreshToken) — never the raw token — in the DB.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private activity: ActivityService,
  ) {}

  async register(dto: {
    email: string;
    password: string;
    fullName: string;
    role: User['role'];
  }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email already registered');

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        fullName: dto.fullName,
        role: dto.role,
        passwordHash: await argon2.hash(dto.password),
      },
    });
    await this.activity.log(user.id, 'user.registered', 'user', user.id);
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Identical error for unknown email and wrong password — don't leak which.
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive) throw new ForbiddenException('Account suspended');
    await this.activity.log(user.id, 'user.login');
    return user;
  }

  /** Issues an access token + rotated refresh token, sets the cookie. */
  async issueTokens(user: User, res: Response) {
    const accessToken = this.jwt.sign({
      sub: user.id,
      role: user.role,
      companyId: user.companyId,
      sa: user.isSuperadmin,
    });

    const rawRefresh = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawRefresh),
        expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400_000),
      },
    });

    res.cookie(REFRESH_COOKIE, rawRefresh, {
      httpOnly: true, // not readable from JS — XSS can't steal it
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: REFRESH_DAYS * 86400_000,
      path: '/',
    });

    return { accessToken, user: this.publicUser(user) };
  }

  /** Rotates the refresh token: validates, revokes old, issues new pair. */
  async refresh(rawToken: string | undefined, res: Response) {
    if (!rawToken) throw new UnauthorizedException('No refresh token');
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash: this.hashToken(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });
    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException('Refresh token invalid');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueTokens(stored.user, res);
  }

  async logout(rawToken: string | undefined, res: Response) {
    if (rawToken) {
      await this.prisma.refreshToken.updateMany({
        where: { tokenHash: this.hashToken(rawToken) },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return { ok: true };
  }

  publicUser(user: User) {
    const { passwordHash: _, ...rest } = user;
    return rest;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
