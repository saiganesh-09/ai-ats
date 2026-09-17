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
import { Role, type User } from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SkillsService } from '../skills/skills.service';

class ProfileDto {
  @IsOptional()
  @IsString()
  headline?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  experience?: Array<{ title: string; company: string; years?: number; description?: string }>;

  @IsOptional()
  education?: Array<{ degree: string; institution: string; year?: number }>;

  @IsOptional()
  certifications?: Array<{ name: string; issuer?: string; year?: number }>;
}

/**
 * The profile API shape is unchanged ({headline, skills[], experience[],
 * education[], certifications[]}) — but underneath, skills and history are
 * normalized rows now. The controller composes/decomposes at the boundary.
 */
@Controller('profiles')
export class ProfilesController {
  constructor(
    private prisma: PrismaService,
    private skills: SkillsService,
  ) {}

  private async compose(userId: number) {
    const [profile, skills, experiences, educations, certifications] =
      await Promise.all([
        this.prisma.profile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        }),
        this.prisma.candidateSkill.findMany({
          where: { userId },
          include: { skill: true },
        }),
        this.prisma.experience.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
        this.prisma.education.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
        this.prisma.certification.findMany({ where: { userId }, orderBy: { id: 'asc' } }),
      ]);
    return {
      headline: profile.headline,
      skills: skills.map((cs) => cs.skill.name),
      experience: experiences.map(({ title, company, years, description }) => ({
        title, company, years, description,
      })),
      education: educations.map(({ degree, institution, year }) => ({
        degree, institution, year,
      })),
      certifications: certifications.map(({ name, issuer, year }) => ({
        name, issuer, year,
      })),
    };
  }

  @Get('mine')
  @Roles(Role.CANDIDATE)
  mine(@CurrentUser() user: User) {
    return this.compose(user.id);
  }

  /** Full replace in one transaction — the editor saves the whole profile. */
  @Put('mine')
  @Roles(Role.CANDIDATE)
  async update(@CurrentUser() user: User, @Body() dto: ProfileDto) {
    if (dto.headline !== undefined) {
      await this.prisma.profile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, headline: dto.headline },
        update: { headline: dto.headline },
      });
    }
    if (dto.skills) await this.skills.syncCandidateSkills(user.id, dto.skills);
    await this.prisma.$transaction(async (tx) => {
      if (dto.experience) {
        await tx.experience.deleteMany({ where: { userId: user.id } });
        await tx.experience.createMany({
          data: dto.experience.map((e) => ({ ...e, userId: user.id })),
        });
      }
      if (dto.education) {
        await tx.education.deleteMany({ where: { userId: user.id } });
        await tx.education.createMany({
          data: dto.education.map((e) => ({ ...e, userId: user.id })),
        });
      }
      if (dto.certifications) {
        await tx.certification.deleteMany({ where: { userId: user.id } });
        await tx.certification.createMany({
          data: dto.certifications.map((c) => ({ ...c, userId: user.id })),
        });
      }
    });
    return this.compose(user.id);
  }

  /** Staff view — only if the candidate applied to one of the company's jobs. */
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
    return this.compose(userId);
  }
}
