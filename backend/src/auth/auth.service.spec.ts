import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';

// argon2 + @nestjs/jwt are ESM — Jest (CJS) can't load them, so mock both.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));
jest.mock('argon2', () => ({
  hash: jest.fn(async (pw: string) => `$argon2hashed$${pw}`),
  verify: jest.fn(async (hash: string, pw: string) => hash === `$argon2hashed$${pw}`),
}));
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { ActivityService } from '../activity/activity.service';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const prisma = {
  user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
} as unknown as PrismaService;

// @nestjs/jwt is ESM — Jest can't import it, so type the stub loosely.
const jwt = { sign: jest.fn().mockReturnValue('jwt-token') } as never;
const activity = { log: jest.fn() } as unknown as ActivityService;
const email = { welcome: jest.fn() } as unknown as EmailService;

const svc = () => new AuthService(prisma, jwt, activity, email);

describe('AuthService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('rejects a duplicate email before hashing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 1 });
      await expect(
        svc().register({ email: 'a@b.co', password: 'x', fullName: 'A', role: Role.CANDIDATE }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password — never stores plaintext', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockImplementation(({ data }) =>
        Promise.resolve({ id: 1, ...data, passwordHash: data.passwordHash }),
      );
      await svc().register({ email: 'a@b.co', password: 'secret123', fullName: 'A', role: Role.CANDIDATE });
      const stored = (prisma.user.create as jest.Mock).mock.calls[0][0].data.passwordHash;
      expect(stored).not.toBe('secret123');
      expect(stored).toContain('$argon2hashed$'); // hashed, never plaintext
    });
  });

  describe('login', () => {
    it('rejects unknown email and bad password identically', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(svc().login('ghost@x.co', 'pw')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a suspended account after password verify', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 1, isActive: false, passwordHash: '$argon2hashed$pw',
      });
      await expect(svc().login('a@b.co', 'pw')).rejects.toThrow(ForbiddenException);
    });
  });
});
