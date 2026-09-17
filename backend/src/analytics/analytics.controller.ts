import { Controller, ForbiddenException, Get } from '@nestjs/common';
import {
  ApplicationStatus,
  JobStatus,
  Prisma,
  Role,
  type User,
} from '@prisma/client';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

@Controller('analytics')
export class AnalyticsController {
  constructor(private prisma: PrismaService) {}

  /**
   * Recruiter dashboard: counters + funnel + 30-day application trend.
   * Everything scoped to the caller's company — multi-tenant analytics.
   */
  @Get('dashboard')
  @Roles(...STAFF)
  async dashboard(@CurrentUser() user: User) {
    if (!user.companyId && !user.isSuperadmin) {
      throw new ForbiddenException('No company');
    }
    const companyId = user.isSuperadmin ? undefined : user.companyId!;
    const jobWhere = companyId ? { companyId } : {};
    const appWhere = companyId ? { job: { companyId } } : {};

    const [
      totalJobs, activeJobs, totalApplicants, shortlisted,
      interviews, offers, hires, rejected, funnel, trend,
    ] = await Promise.all([
      this.prisma.job.count({ where: jobWhere }),
      this.prisma.job.count({ where: { ...jobWhere, status: JobStatus.PUBLISHED } }),
      this.prisma.application.count({ where: appWhere }),
      this.prisma.application.count({
        where: { ...appWhere, status: ApplicationStatus.SHORTLISTED },
      }),
      this.prisma.interview.count({
        where: companyId ? { application: appWhere } : {},
      }),
      this.prisma.application.count({
        where: { ...appWhere, status: { in: [ApplicationStatus.OFFER, ApplicationStatus.HIRED] } },
      }),
      this.prisma.application.count({
        where: { ...appWhere, status: ApplicationStatus.HIRED },
      }),
      this.prisma.application.count({
        where: { ...appWhere, status: ApplicationStatus.REJECTED },
      }),
      // Hiring funnel: count per status, single GROUP BY query.
      this.prisma.application.groupBy({
        by: ['status'],
        where: appWhere,
        _count: { _all: true },
      }),
      // Applications per day, last 30 days — raw SQL for date_trunc.
      // Prisma.sql/empty compose the conditional company filter safely.
      this.prisma.$queryRaw<{ day: string; count: number }[]>`
        SELECT to_char(date_trunc('day', a.created_at), 'YYYY-MM-DD') AS day,
               count(*)::int AS count
        FROM applications a JOIN jobs j ON a.job_id = j.id
        WHERE a.created_at > now() - interval '30 days'
        ${companyId ? Prisma.sql`AND j.company_id = ${companyId}` : Prisma.empty}
        GROUP BY 1 ORDER BY 1
      `,
    ]);

    const decided = rejected + hires;
    return {
      totalJobs,
      activeJobs,
      totalApplicants,
      shortlisted,
      interviewsScheduled: interviews,
      offers,
      hires,
      rejectionRate: decided ? Math.round((100 * rejected) / decided) : 0,
      funnel: Object.fromEntries(funnel.map((f) => [f.status, f._count._all])),
      trend,
    };
  }
}
