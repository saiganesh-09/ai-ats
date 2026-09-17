import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Put,
} from '@nestjs/common';
import { IsArray, IsOptional, IsString } from 'class-validator';
import { Prisma, Role, type User } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class ProfileDto {
  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  // Structured work history: [{title, company, years, description}]
  @IsOptional()
  experience?: unknown[];

  @IsOptional()
  education?: unknown[];

  @IsOptional()
  certifications?: unknown[];
}

@Controller('profiles')
export class ProfilesController {
  constructor(private prisma: PrismaService) {}

  @Get('mine')
  @Roles(Role.CANDIDATE)
  mine(@CurrentUser() user: User) {
    return this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  /** Upsert: the profile is created on first save — no separate create endpoint. */
  @Put('mine')
  @Roles(Role.CANDIDATE)
  update(@CurrentUser() user: User, @Body() dto: ProfileDto) {
    const data = {
      headline: dto.headline,
      skills: dto.skills,
      experience: dto.experience as Prisma.InputJsonValue | undefined,
      education: dto.education as Prisma.InputJsonValue | undefined,
      certifications: dto.certifications as Prisma.InputJsonValue | undefined,
    };
    return this.prisma.profile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    });
  }

  /** Staff view of a candidate profile — only if that candidate applied to one
   *  of the requesting company's jobs (or the viewer is a superadmin). */
  @Get('candidate/:userId')
  @Roles(Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async candidateProfile(
    @CurrentUser() user: User,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    if (!user.isSuperadmin) {
      const applied = await this.prisma.application.findFirst({
        where: {
          candidateId: userId,
          job: { companyId: user.companyId ?? -1 },
        },
      });
      if (!applied) throw new ForbiddenException('Candidate has not applied to your jobs');
    }
    return this.prisma.profile.findUnique({ where: { userId } });
  }
}
