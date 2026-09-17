import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  EmploymentType,
  ExperienceLevel,
  JobStatus,
  Role,
  WorkMode,
  type Prisma,
  type User,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AiService } from '../ai/ai.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SkillsService } from '../skills/skills.service';

// ---------- DTOs (spec: "implement validation") ----------

class JobDto {
  @IsString() @MinLength(2) title!: string;
  @IsOptional() @IsString() location?: string;
  @IsString() @MinLength(20) description!: string;
  @IsOptional() @IsString() requirements?: string;

  @IsEnum(EmploymentType) employmentType!: EmploymentType;
  @IsEnum(ExperienceLevel) experienceLevel!: ExperienceLevel;
  @IsEnum(WorkMode) workMode!: WorkMode;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsString() educationRequirement?: string;
  @IsOptional() @IsDateString() applicationDeadline?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) openings?: number;

  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredSkills?: string[];
  @IsOptional() @IsInt() hiringManagerId?: number;
}

// Update = every field optional; same validation rules.
class JobUpdateDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() @MinLength(20) description?: string;
  @IsOptional() @IsString() requirements?: string;
  @IsOptional() @IsEnum(EmploymentType) employmentType?: EmploymentType;
  @IsOptional() @IsEnum(ExperienceLevel) experienceLevel?: ExperienceLevel;
  @IsOptional() @IsEnum(WorkMode) workMode?: WorkMode;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) salaryMax?: number;
  @IsOptional() @IsString() educationRequirement?: string;
  @IsOptional() @IsDateString() applicationDeadline?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) openings?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredSkills?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredSkills?: string[];
  @IsOptional() @IsInt() hiringManagerId?: number;
}

class ReportDto {
  @IsString() @MinLength(5) reason!: string;
}

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

@Controller('jobs')
export class JobsController {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private ai: AiService,
    private skills: SkillsService,
  ) {}

  // ---------- public job board: search / filter / sort / paginate ----------

  /**
   * All filtering happens in SQL — the spec forbids loading the table and
   * filtering in memory. Supported params:
   *   q, location, skills (csv), experienceLevel, employmentType, workMode,
   *   salaryMin, salaryMax, postedWithin (days), sort, page, pageSize
   */
  @Public()
  @Get()
  async list(
    @Query('q') q?: string,
    @Query('location') location?: string,
    @Query('skills') skillsCsv?: string,
    @Query('experienceLevel') experienceLevel?: ExperienceLevel,
    @Query('employmentType') employmentType?: EmploymentType,
    @Query('workMode') workMode?: WorkMode,
    @Query('salaryMin') salaryMin?: string,
    @Query('salaryMax') salaryMax?: string,
    @Query('postedWithin') postedWithin?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const skillNames = skillsCsv
      ?.split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const where: Prisma.JobWhereInput = {
      status: JobStatus.PUBLISHED,
      // Only show postings still accepting applications.
      OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
      ...(q
        ? {
            AND: [{
              OR: [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
                { company: { name: { contains: q, mode: 'insensitive' } } },
              ],
            }],
          }
        : {}),
      ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      ...(experienceLevel ? { experienceLevel } : {}),
      ...(employmentType ? { employmentType } : {}),
      ...(workMode ? { workMode } : {}),
      // Salary filter: candidate's floor must be within the posting's range.
      ...(Number(salaryMin) ? { salaryMax: { gte: Number(salaryMin) } } : {}),
      ...(Number(salaryMax) ? { salaryMin: { lte: Number(salaryMax) } } : {}),
      ...(Number(postedWithin)
        ? { createdAt: { gte: new Date(Date.now() - Number(postedWithin) * 864e5) } }
        : {}),
      ...(skillNames?.length
        ? { skills: { some: { skill: { name: { in: skillNames } } } } }
        : {}),
    };

    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      sort === 'oldest' ? [{ createdAt: 'asc' }]
      : sort === 'title' ? [{ title: 'asc' }]
      : sort === 'salary' ? [{ salaryMax: { sort: 'desc', nulls: 'last' } }]
      : [{ createdAt: 'desc' }];

    const pageNum = Math.max(1, Number(page) || 1);
    const take = Math.min(50, Math.max(1, Number(pageSize) || 10));
    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where, orderBy, take, skip: (pageNum - 1) * take,
        include: {
          company: { select: { name: true } },
          skills: { include: { skill: { select: { name: true } } } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return {
      items,
      total,
      page: pageNum,
      pageSize: take,
      totalPages: Math.ceil(total / take),
    };
  }

  @Public()
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: { select: { name: true } },
        skills: { include: { skill: { select: { name: true } } } },
      },
    });
    if (!job || job.status === JobStatus.DRAFT) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  // ---------- staff views ----------

  @Get('manage/list')
  @Roles(...STAFF)
  manage(@CurrentUser() user: User) {
    // Recruiters/admins see all company jobs; hiring managers only assigned ones.
    const where: Prisma.JobWhereInput =
      user.role === Role.HIRING_MANAGER && !user.isSuperadmin
        ? { hiringManagerId: user.id }
        : { companyId: user.companyId ?? -1 };
    return this.prisma.job.findMany({
      where: user.isSuperadmin ? {} : where,
      include: {
        company: { select: { name: true } },
        hiringManager: { select: { id: true, fullName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- recruiter/admin CRUD + lifecycle ----------

  @Post()
  @Roles(Role.RECRUITER, Role.ADMIN)
  async create(@CurrentUser() user: User, @Body() dto: JobDto) {
    if (!user.companyId) {
      throw new BadRequestException('Create or join a company first');
    }
    if (dto.salaryMin && dto.salaryMax && dto.salaryMin > dto.salaryMax) {
      throw new BadRequestException('salaryMin cannot exceed salaryMax');
    }
    if (dto.applicationDeadline && new Date(dto.applicationDeadline) < new Date()) {
      throw new BadRequestException('Application deadline must be in the future');
    }
    await this.assertHiringManager(dto.hiringManagerId, user.companyId);
    const { requiredSkills, preferredSkills, ...data } = dto;
    const job = await this.prisma.job.create({
      data: { ...data, companyId: user.companyId, recruiterId: user.id },
    });
    await this.syncSkills(job.id, requiredSkills, preferredSkills, job);
    await this.activity.log(user.id, 'job.created', 'job', job.id);
    return job;
  }

  @Patch(':id')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async update(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: JobUpdateDto,
  ) {
    const job = await this.companyJob(id, user);
    if (dto.salaryMin && dto.salaryMax && dto.salaryMin > dto.salaryMax) {
      throw new BadRequestException('salaryMin cannot exceed salaryMax');
    }
    await this.assertHiringManager(dto.hiringManagerId, job.companyId);
    const { requiredSkills, preferredSkills, ...data } = dto;
    const updated = await this.prisma.job.update({ where: { id: job.id }, data });
    // Re-sync skills when text OR explicit skill lists changed.
    if (requiredSkills || preferredSkills ||
        dto.description !== undefined || dto.requirements !== undefined) {
      await this.syncSkills(updated.id, requiredSkills, preferredSkills, updated);
    }
    await this.activity.log(
      user.id, 'job.updated', 'job', id, { fields: Object.keys(dto) },
    );
    return updated;
  }

  /** DRAFT → PUBLISHED, and PAUSED → PUBLISHED (resume). */
  @Post(':id/publish')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async publish(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    if (job.status === JobStatus.CLOSED) {
      throw new BadRequestException('Closed jobs cannot be republished');
    }
    await this.activity.log(user.id, 'job.published', 'job', id);
    return this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.PUBLISHED },
    });
  }

  /** PUBLISHED → PAUSED (hidden from the board, applications preserved). */
  @Post(':id/pause')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async pause(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    if (job.status !== JobStatus.PUBLISHED) {
      throw new BadRequestException('Only published jobs can be paused');
    }
    await this.activity.log(user.id, 'job.paused', 'job', id);
    return this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.PAUSED },
    });
  }

  @Post(':id/close')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async close(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    await this.activity.log(user.id, 'job.closed', 'job', id);
    return this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.CLOSED },
    });
  }

  /**
   * Delete a posting — only when it has no applications. Applications
   * cascade-delete with the job, so refusing here prevents silently
   * destroying candidate records; jobs with applicants must be CLOSED instead.
   */
  @Delete(':id')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    const apps = await this.prisma.application.count({ where: { jobId: job.id } });
    if (apps > 0) {
      throw new BadRequestException(
        `Cannot delete a job with ${apps} application(s) — close it instead`,
      );
    }
    await this.prisma.job.delete({ where: { id: job.id } });
    await this.activity.log(user.id, 'job.deleted', 'job', id);
    return { ok: true };
  }

  @Post(':id/analyze')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async analyze(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    return this.ai.analyzeJobDescription(job.title, job.description);
  }

  // ---------- candidate: saved jobs + reports ----------

  @Post(':id/save')
  @Roles(Role.CANDIDATE)
  async save(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.openJob(id);
    return this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId: user.id, jobId: id } },
      create: { userId: user.id, jobId: id },
      update: {},
    });
  }

  @Delete(':id/save')
  @Roles(Role.CANDIDATE)
  @HttpCode(204)
  async unsave(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    await this.prisma.savedJob.deleteMany({
      where: { userId: user.id, jobId: id },
    });
  }

  @Get('saved/mine')
  @Roles(Role.CANDIDATE)
  saved(@CurrentUser() user: User) {
    return this.prisma.savedJob.findMany({
      where: { userId: user.id },
      include: { job: { include: { company: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/report')
  @Roles(Role.CANDIDATE)
  async report(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReportDto,
  ) {
    await this.openJob(id);
    const report = await this.prisma.report.create({
      data: { reporterId: user.id, jobId: id, reason: dto.reason },
    });
    await this.activity.log(user.id, 'job.reported', 'job', id);
    return report;
  }

  // ---------- helpers ----------

  /** Explicit lists win; otherwise extract skills from the posting text. */
  private async syncSkills(
    jobId: number,
    required: string[] | undefined,
    preferred: string[] | undefined,
    job: { description: string; requirements: string | null },
  ) {
    const req = required ?? this.skills.extractFromText(
      `${job.description} ${job.requirements ?? ''}`,
    );
    await this.skills.syncJobSkills(jobId, req, preferred ?? []);
  }

  private async openJob(id: number) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    const pastDeadline = job?.applicationDeadline && job.applicationDeadline < new Date();
    if (!job || job.status !== JobStatus.PUBLISHED || pastDeadline) {
      throw new NotFoundException('Job not available');
    }
    return job;
  }

  /** Staff can only touch jobs in their own company (superadmin bypasses). */
  private async companyJob(id: number, user: User) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (!user.isSuperadmin && job.companyId !== user.companyId) {
      throw new ForbiddenException('Not your company\'s job');
    }
    return job;
  }

  private async assertHiringManager(hmId: number | undefined, companyId: number) {
    if (hmId === undefined) return;
    const hm = await this.prisma.user.findUnique({ where: { id: hmId } });
    if (!hm || hm.companyId !== companyId || hm.role !== Role.HIRING_MANAGER) {
      throw new BadRequestException('Invalid hiring manager');
    }
  }
}
