import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { IsBoolean, IsIn } from 'class-validator';
import {
  ApplicationStatus,
  JobStatus,
  Prisma,
  ReportStatus,
  Role,
  type User,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class UserStatusDto {
  @IsBoolean() isActive!: boolean;
}

class ReportUpdateDto {
  @IsIn(['RESOLVED', 'DISMISSED']) status!: ReportStatus;
}

/**
 * Admin endpoints. Two tiers, same controller:
 * - isSuperadmin → sees everything across the platform
 * - Role.ADMIN (company admin) → same actions scoped to their own company
 */
@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  private scope(user: User): { companyId?: number } {
    // Superadmin → no scope (sees all); company admin → locked to their org.
    return user.isSuperadmin ? {} : { companyId: user.companyId! };
  }

  @Get('analytics')
  async analytics(@CurrentUser() user: User) {
    const { companyId } = this.scope(user);
    const userWhere = companyId ? { companyId } : {};
    const jobWhere = companyId ? { companyId } : {};
    const appWhere = companyId ? { job: { companyId } } : {};

    const [
      totalUsers,
      totalCandidates,
      totalRecruiters,
      totalCompanies,
      totalJobs,
      activeJobs,
      totalApplications,
      successfulHires,
      signupsTrend,
      appsTrend,
    ] = await Promise.all([
      this.prisma.user.count({ where: userWhere }),
      this.prisma.user.count({ where: { ...userWhere, role: Role.CANDIDATE } }),
      this.prisma.user.count({
        where: { ...userWhere, role: { in: [Role.RECRUITER, Role.ADMIN] } },
      }),
      this.prisma.company.count({ where: companyId ? { id: companyId } : {} }),
      this.prisma.job.count({ where: jobWhere }),
      this.prisma.job.count({
        where: { ...jobWhere, status: JobStatus.PUBLISHED },
      }),
      this.prisma.application.count({ where: appWhere }),
      this.prisma.application.count({
        where: { ...appWhere, status: ApplicationStatus.HIRED },
      }),
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               count(*)::int AS count FROM users
        WHERE created_at > now() - interval '30 days'
        ${companyId ? Prisma.sql`AND company_id = ${companyId}` : Prisma.empty}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('day', a.created_at), 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM applications a JOIN jobs j ON a.job_id = j.id
        WHERE a.created_at > now() - interval '30 days'
        ${companyId ? Prisma.sql`AND j.company_id = ${companyId}` : Prisma.empty}
        GROUP BY 1 ORDER BY 1`,
    ]);

    return {
      totalUsers,
      totalCandidates,
      totalRecruiters,
      totalCompanies,
      totalJobs,
      activeJobs,
      totalApplications,
      successfulHires,
      signupsTrend,
      appsTrend,
    };
  }

  @Get('users')
  async users(
    @CurrentUser() user: User,
    @Query('q') q?: string,
    @Query('role') role?: Role,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const { companyId } = this.scope(user);
    const where: Prisma.UserWhereInput = {
      ...(companyId ? { companyId } : {}),
      ...(role ? { role } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          isSuperadmin: true,
          companyId: true,
          createdAt: true,
          company: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items,
      total,
      page: p,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  }

  /** Suspend/activate. Company admins can't touch superadmins or themselves. */
  @Patch('users/:id/status')
  async setUserStatus(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UserStatusDto,
  ) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (!user.isSuperadmin) {
      if (
        target.companyId !== user.companyId ||
        target.isSuperadmin ||
        target.id === user.id
      ) {
        throw new ForbiddenException('Cannot modify this user');
      }
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: { id: true, email: true, isActive: true },
    });
    await this.activity.log(
      user.id,
      dto.isActive ? 'user.activated' : 'user.suspended',
      'user',
      id,
    );
    return updated;
  }

  @Get('companies')
  companies(@CurrentUser() user: User) {
    const { companyId } = this.scope(user);
    return this.prisma.company.findMany({
      where: companyId ? { id: companyId } : {},
      include: {
        _count: { select: { users: true, jobs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** All jobs in scope — the admin job-management table. */
  @Get('jobs')
  jobs(@CurrentUser() user: User) {
    const { companyId } = this.scope(user);
    return this.prisma.job.findMany({
      where: companyId ? { companyId } : {},
      include: {
        company: { select: { name: true } },
        recruiter: { select: { fullName: true } },
        _count: { select: { applications: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** All applications in scope — the admin application-management table. */
  @Get('applications')
  applications(@CurrentUser() user: User) {
    const { companyId } = this.scope(user);
    return this.prisma.application.findMany({
      where: companyId ? { job: { companyId } } : {},
      include: {
        candidate: { select: { fullName: true, email: true } },
        job: { select: { title: true, company: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  /** Remove an inappropriate job post (reports workflow). */
  @Delete('jobs/:id')
  async deleteJob(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (!user.isSuperadmin && job.companyId !== user.companyId) {
      throw new ForbiddenException("Not your company's job");
    }
    await this.prisma.job.delete({ where: { id } });
    await this.activity.log(user.id, 'job.deleted_by_admin', 'job', id);
    return { ok: true };
  }

  @Get('reports')
  reports(@CurrentUser() user: User) {
    const { companyId } = this.scope(user);
    return this.prisma.report.findMany({
      where: companyId ? { job: { companyId } } : {},
      include: {
        reporter: { select: { fullName: true, email: true } },
        job: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Patch('reports/:id')
  async resolveReport(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReportUpdateDto,
  ) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (!user.isSuperadmin && report.job.companyId !== user.companyId) {
      throw new ForbiddenException("Not your company's report");
    }
    const updated = await this.prisma.report.update({
      where: { id },
      data: { status: dto.status },
    });
    await this.activity.log(user.id, 'report.resolved', 'report', id, {
      status: dto.status,
    });
    return updated;
  }

  @Get('activity')
  async activityLog(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const { companyId } = this.scope(user);
    const where = companyId ? { actor: { companyId } } : {};
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const [items, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        include: { actor: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return {
      items,
      total,
      page: p,
      pageSize: size,
      totalPages: Math.max(1, Math.ceil(total / size)),
    };
  }
}
