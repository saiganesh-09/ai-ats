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

  /**
   * Candidate dashboard: profile completion, own-pipeline counts, upcoming
   * interviews, and jobs recommended by skill overlap — the payoff of the
   * normalized skills taxonomy (candidate_skills ⋈ job_skills).
   */
  @Get('candidate-dashboard')
  @Roles(Role.CANDIDATE)
  async candidateDashboard(@CurrentUser() user: User) {
    const [profile, skillLinks, statusCounts, savedCount, upcoming, unread, resumeCount, appliedJobIds] =
      await Promise.all([
        this.prisma.profile.findUnique({ where: { userId: user.id } }),
        this.prisma.candidateSkill.findMany({
          where: { userId: user.id }, select: { skillId: true },
        }),
        this.prisma.application.groupBy({
          by: ['status'], where: { candidateId: user.id }, _count: { _all: true },
        }),
        this.prisma.savedJob.count({ where: { userId: user.id } }),
        this.prisma.interview.count({
          where: { application: { candidateId: user.id }, scheduledAt: { gte: new Date() } },
        }),
        this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
        this.prisma.resume.count({ where: { candidateId: user.id } }),
        this.prisma.application.findMany({
          where: { candidateId: user.id }, select: { jobId: true },
        }),
      ]);

    // Profile completion: 8 weighted checkpoints, each worth ~12.5%.
    const [expCount, eduCount, certCount] = await Promise.all([
      this.prisma.experience.count({ where: { userId: user.id } }),
      this.prisma.education.count({ where: { userId: user.id } }),
      this.prisma.certification.count({ where: { userId: user.id } }),
    ]);
    const checks = [
      !!profile?.headline,
      skillLinks.length > 0, skillLinks.length >= 5,
      expCount > 0, expCount >= 2, eduCount > 0,
      certCount > 0, resumeCount > 0,
    ];
    const profileCompletion = Math.round((checks.filter(Boolean).length / checks.length) * 100);

    // Recommended jobs: PUBLISHED + deadline-open + not applied + shares ≥1 skill.
    // Overlap counting happens in JS on the already-filtered set — the published
    // pool is bounded and far smaller than the full table.
    const mySkillIds = new Set(skillLinks.map((l) => l.skillId));
    const applied = new Set(appliedJobIds.map((a) => a.jobId));
    const candidates = await this.prisma.job.findMany({
      where: {
        status: JobStatus.PUBLISHED,
        id: { notIn: [...applied] },
        OR: [{ applicationDeadline: null }, { applicationDeadline: { gte: new Date() } }],
        ...(mySkillIds.size
          ? { skills: { some: { skillId: { in: [...mySkillIds] } } } }
          : {}),
      },
      include: {
        company: { select: { name: true } },
        skills: { select: { skillId: true, required: true } },
      },
      take: 100,
    });
    const recommendedJobs = candidates
      .map((j) => ({
        id: j.id,
        title: j.title,
        company: j.company.name,
        location: j.location,
        workMode: j.workMode,
        employmentType: j.employmentType,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        // Weight required skills double — they matter more to fit.
        matchCount: j.skills.reduce(
          (n, s) => n + (mySkillIds.has(s.skillId) ? (s.required ? 2 : 1) : 0), 0,
        ),
      }))
      .filter((j) => j.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 5);

    return {
      profileCompletion,
      missingCheckpoints: checks.filter((c) => !c).length,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count._all])),
      savedJobs: savedCount,
      upcomingInterviews: upcoming,
      unreadNotifications: unread,
      recommendedJobs,
    };
  }
}
