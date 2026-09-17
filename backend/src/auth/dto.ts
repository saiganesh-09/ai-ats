import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import type { Role } from '@prisma/client';

const PUBLIC_ROLES = ['CANDIDATE', 'RECRUITER', 'HIRING_MANAGER'] as const;

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  fullName!: string;

  // ADMIN and superadmin are never self-serve — they're granted by other admins.
  @IsIn(PUBLIC_ROLES)
  role!: Role;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
