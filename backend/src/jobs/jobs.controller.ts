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
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { JobStatus, Role, type Prisma, type User } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AiService } from '../ai/ai.service';
import { CurrentUser, Public, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class JobDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  @MinLength(20)
  description!: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsInt()
  hiringManagerId?: number;
}

class JobUpdateDto {
  @IsOptional() @IsString() @MinLength(2) title?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() @MinLength(20) description?: string;
  @IsOptional() @IsString() requirements?: string;
  @IsOptional() @IsInt() hiringManagerId?: number;
}

class ReportDto {
  @IsString()
  @MinLength(5)
  reason!: string;
}

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

@Controller('jobs')
export class JobsController {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
    private ai: AiService,
  ) {}

  // ---------- public job board ----------

  @Public()
  @Get()
  list(
    @Query('q') q?: string,
    @Query('location') location?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    const orderBy: Prisma.JobOrderByWithRelationInput =
      sort === 'title' ? { title: 'asc' }
      : sort === 'oldest' ? { createdAt: 'asc' }
      : { createdAt: 'desc' };
    return this.prisma.job.findMany({
      where: {
        status: JobStatus.OPEN,
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
      },
      include: { company: { select: { name: true } } },
      orderBy,
      take: 20,
      skip: (Number(page) > 0 ? Number(page) - 1 : 0) * 20,
    });
  }

  @Public()
  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { company: { select: { name: true } } },
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
    await this.assertHiringManager(dto.hiringManagerId, user.companyId);
    const job = await this.prisma.job.create({
      data: {
        ...dto,
        companyId: user.companyId,
        recruiterId: user.id,
      },
    });
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
    await this.assertHiringManager(dto.hiringManagerId, job.companyId);
    return this.prisma.job.update({ where: { id: job.id }, data: dto });
  }

  @Post(':id/publish')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async publish(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    await this.activity.log(user.id, 'job.published', 'job', id);
    return this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.OPEN },
    });
  }

  @Post(':id/unpublish')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async unpublish(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const job = await this.companyJob(id, user);
    return this.prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.DRAFT },
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

  private async openJob(id: number) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job || job.status !== JobStatus.OPEN) {
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
