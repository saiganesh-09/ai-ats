import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import {
  ApplicationStatus,
  JobStatus,
  Role,
  type Application,
  type Prisma,
  type User,
} from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { CurrentUser, Roles } from '../common/decorators';
import { NotificationsService } from '../notifications/notifications.controller';
import { PrismaService } from '../prisma/prisma.service';

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

// Candidates can only withdraw while the process hasn't advanced past screening.
const WITHDRAWABLE: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
];

class ApplyDto {
  @IsInt() jobId!: number;
  @IsInt() resumeId!: number;
  @IsOptional() @IsString() coverNote?: string;
}

class StatusDto {
  @IsIn([
    'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED',
  ] as const)
  status!: ApplicationStatus;

  @IsOptional() @IsString() reason?: string; // recorded on the history row
}

class AssignDto {
  @IsInt() recruiterId!: number;
}

class NoteDto {
  @IsString() @MinLength(1) text!: string;
}

class FeedbackDto {
  @IsString() @MinLength(1) text!: string;
  @IsOptional() @IsInt() @Min(1) @Max(5) rating?: number;
  @IsOptional() @IsInt() interviewId?: number;
}

class QuestionsDto {
  @IsObject()
  questions!: Record<string, string[]>;
}

@Controller('applications')
export class ApplicationsController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private activity: ActivityService,
    private notifications: NotificationsService,
    private email: EmailService,
  ) {}

  /** Record a status transition — the immutable audit trail of the pipeline. */
  private recordHistory(
    applicationId: number,
    fromStatus: ApplicationStatus | null,
    toStatus: ApplicationStatus,
    changedById?: number,
    reason?: string,
  ) {
    return this.prisma.applicationStatusHistory.create({
      data: { applicationId, fromStatus, toStatus, changedById, reason },
    });
  }

  // ---------- candidate ----------

  @Post()
  @Roles(Role.CANDIDATE)
  async apply(@CurrentUser() user: User, @Body() dto: ApplyDto) {
    const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
    if (!job || job.status !== JobStatus.PUBLISHED) {
      throw new NotFoundException('Job not available');
    }
    const resume = await this.prisma.resume.findUnique({
      where: { id: dto.resumeId },
    });
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException('Resume not found');
    }
    try {
      const application = await this.prisma.application.create({
        data: {
          jobId: job.id,
          candidateId: user.id,
          resumeId: resume.id,
          coverNote: dto.coverNote,
        },
        include: { job: { include: { company: { select: { name: true } } } } },
      });
      await this.recordHistory(application.id, null, ApplicationStatus.APPLIED, user.id);
      // Candidate gets a receipt; the owning recruiter gets a new-application ping.
      await this.notifications.notify(user.id, 'application.submitted', {
        applicationId: application.id,
        jobTitle: job.title,
      });
      this.email.applicationConfirmation(user.email, user.fullName, job.title);
      if (job.recruiterId !== user.id) {
        await this.notifications.notify(job.recruiterId, 'application.new', {
          applicationId: application.id,
          jobTitle: job.title,
          candidateName: user.fullName,
        });
      }
      await this.activity.log(user.id, 'application.submitted', 'application', application.id);
      return application;
    } catch (e) {
      // Unique constraint (jobId, candidateId) → already applied
      if ((e as { code?: string }).code === 'P2002') {
        throw new BadRequestException('Already applied to this job');
      }
      throw e;
    }
  }

  @Get('mine')
  @Roles(Role.CANDIDATE)
  mine(@CurrentUser() user: User) {
    return this.prisma.application.findMany({
      where: { candidateId: user.id },
      include: {
        job: { include: { company: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Post(':id/withdraw')
  @Roles(Role.CANDIDATE)
  async withdraw(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: { job: true },
    });
    if (!app || app.candidateId !== user.id) {
      throw new NotFoundException('Application not found');
    }
    if (!WITHDRAWABLE.includes(app.status)) {
      throw new BadRequestException(
        `Cannot withdraw at ${app.status} stage`,
      );
    }
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: ApplicationStatus.WITHDRAWN },
    });
    await this.recordHistory(id, app.status, ApplicationStatus.WITHDRAWN, user.id);
    // Candidate response → the owning recruiter sees it immediately.
    await this.notifications.notify(app.job.recruiterId, 'candidate.withdrawn', {
      applicationId: app.id,
      jobTitle: app.job.title,
      candidateName: user.fullName,
    });
    return updated;
  }

  // ---------- staff pipeline ----------

  /** Applicants for one job, with search/filter/sort. Company- or HM-scoped. */
  @Get('job/:jobId')
  @Roles(...STAFF)
  async pipeline(
    @CurrentUser() user: User,
    @Param('jobId', ParseIntPipe) jobId: number,
    @Query('q') q?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('sort') sort?: string,
  ) {
    await this.staffJob(jobId, user);
    const orderBy: Prisma.ApplicationOrderByWithRelationInput =
      sort === 'score_asc' ? { matchScore: 'asc' }
      : sort === 'oldest' ? { createdAt: 'asc' }
      : { matchScore: { sort: 'desc', nulls: 'last' } };
    return this.prisma.application.findMany({
      where: {
        jobId,
        ...(status ? { status } : {}),
        ...(q
          ? {
              candidate: {
                OR: [
                  { fullName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        candidate: {
          select: { id: true, fullName: true, email: true, profile: true },
        },
        resume: { select: { id: true, originalFilename: true, parsed: true } },
        assignedRecruiter: { select: { id: true, fullName: true } },
      },
      orderBy,
    });
  }

  /** Full detail for the staff review view: notes, feedback, interviews. */
  @Get(':id')
  @Roles(...STAFF)
  async detail(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const app = await this.staffApplication(id, user);
    return this.prisma.application.findUnique({
      where: { id: app.id },
      include: {
        job: { include: { company: { select: { name: true } } } },
        candidate: {
          select: {
            id: true, fullName: true, email: true, profile: true,
            skills: { include: { skill: { select: { name: true } } } },
            experiences: { orderBy: { id: 'asc' } },
          },
        },
        resume: true,
        assignedRecruiter: { select: { id: true, fullName: true } },
        notes: {
          include: { author: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
        feedback: {
          include: { author: { select: { fullName: true, role: true } } },
          orderBy: { createdAt: 'desc' },
        },
        interviews: { orderBy: { scheduledAt: 'desc' } },
        history: {
          include: { changedBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  @Patch(':id/status')
  @Roles(...STAFF)
  async setStatus(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StatusDto,
  ) {
    const app = await this.staffApplication(id, user);
    const updated = await this.prisma.application.update({
      where: { id: app.id },
      data: { status: dto.status },
    });
    await this.recordHistory(app.id, app.status, dto.status, user.id, dto.reason);
    await this.notifications.notify(app.candidateId, 'application.status', {
      applicationId: app.id,
      jobId: app.jobId,
      status: dto.status,
    });
    this.email.statusUpdate(app.candidate.email, app.candidate.fullName, app.job.title, dto.status);
    if (dto.status === ApplicationStatus.OFFER) {
      this.email.offerNotification(app.candidate.email, app.candidate.fullName, app.job.title);
    }
    await this.activity.log(
      user.id, 'application.status_changed', 'application', app.id,
      { status: dto.status },
    );
    return updated;
  }

  @Patch(':id/assign')
  @Roles(Role.RECRUITER, Role.ADMIN)
  async assign(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignDto,
  ) {
    const app = await this.staffApplication(id, user);
    const recruiter = await this.prisma.user.findUnique({
      where: { id: dto.recruiterId },
    });
    if (
      !recruiter ||
      recruiter.companyId !== app.job.companyId ||
      recruiter.role === Role.CANDIDATE
    ) {
      throw new BadRequestException('Invalid assignee');
    }
    return this.prisma.application.update({
      where: { id: app.id },
      data: { assignedRecruiterId: recruiter.id },
    });
  }

  // ---------- notes & feedback ----------

  @Post(':id/notes')
  @Roles(...STAFF)
  async addNote(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: NoteDto,
  ) {
    const app = await this.staffApplication(id, user);
    return this.prisma.note.create({
      data: { applicationId: app.id, authorId: user.id, text: dto.text },
      include: { author: { select: { fullName: true } } },
    });
  }

  @Post(':id/feedback')
  @Roles(...STAFF)
  async addFeedback(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FeedbackDto,
  ) {
    const app = await this.staffApplication(id, user);
    const fb = await this.prisma.feedback.create({
      data: {
        applicationId: app.id,
        interviewId: dto.interviewId,
        authorId: user.id,
        rating: dto.rating,
        text: dto.text,
      },
      include: { author: { select: { fullName: true, role: true } } },
    });
    // Feedback lands on the owning recruiter's notification center
    // (unless they wrote it themselves).
    if (app.job.recruiterId !== user.id) {
      await this.notifications.notify(app.job.recruiterId, 'feedback.new', {
        applicationId: app.id,
        jobTitle: app.job.title,
        authorName: user.fullName,
      });
    }
    return fb;
  }

  // ---------- AI actions ----------

  @Post(':id/score')
  @Roles(...STAFF)
  async score(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const app = await this.staffApplication(id, user);
    const result = await this.ai.scoreMatch(
      app.resume.parsed ?? { raw_text: app.resume.rawText.slice(0, 4000) },
      app.job.title,
      app.job.description,
      app.job.requirements,
    );
    await this.prisma.application.update({
      where: { id: app.id },
      data: { matchScore: result.score, matchDetails: result as object },
    });
    return result;
  }

  @Post(':id/summarize')
  @Roles(...STAFF)
  async summarize(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const app = await this.staffApplication(id, user);
    const result = await this.ai.summarizeCandidate(
      app.resume.parsed,
      app.job.title,
      app.job.requirements,
    );
    await this.prisma.application.update({
      where: { id: app.id },
      data: { aiSummary: result as object },
    });
    return result;
  }

  /** Generate (or regenerate) categorized interview questions — persisted. */
  @Post(':id/questions')
  @Roles(...STAFF)
  async questions(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const app = await this.staffApplication(id, user);
    const bank = await this.ai.generateInterviewQuestions(
      app.resume.parsed,
      app.job.title,
      app.job.description,
    );
    await this.prisma.application.update({
      where: { id: app.id },
      data: { aiQuestions: bank as object },
    });
    return bank;
  }

  /** Save recruiter-edited questions — the AI drafts, the human owns. */
  @Put(':id/questions')
  @Roles(...STAFF)
  async saveQuestions(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: QuestionsDto,
  ) {
    const app = await this.staffApplication(id, user);
    const q = dto.questions;
    const valid = q && typeof q === 'object' && !Array.isArray(q) &&
      Object.values(q).every((arr) => Array.isArray(arr) && arr.every((s) => typeof s === 'string'));
    if (!valid) throw new BadRequestException('questions must be {category: string[]}');
    const updated = await this.prisma.application.update({
      where: { id: app.id },
      data: { aiQuestions: q as object },
    });
    return updated.aiQuestions;
  }

  // ---------- scoping helpers ----------

  /** Load a job and enforce: superadmin, same-company staff, or assigned HM. */
  private async staffJob(jobId: number, user: User) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (user.isSuperadmin) return job;
    if (user.role === Role.HIRING_MANAGER) {
      if (job.hiringManagerId !== user.id) {
        throw new ForbiddenException('Not assigned to this job');
      }
    } else if (job.companyId !== user.companyId) {
      throw new ForbiddenException('Not your company\'s job');
    }
    return job;
  }

  private async staffApplication(id: number, user: User) {
    const app = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: true,
        resume: true,
        candidate: { select: { email: true, fullName: true } },
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    await this.staffJob(app.jobId, user);
    return app as Application & { job: { companyId: number }; resume: { parsed: unknown; rawText: string } } & typeof app;
  }
}
