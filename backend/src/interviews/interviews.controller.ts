import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { ApplicationStatus, InterviewType, Role, type User } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser, Roles } from '../common/decorators';
import { NotificationsService } from '../notifications/notifications.controller';
import { PrismaService } from '../prisma/prisma.service';

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

class ScheduleDto {
  @IsInt() applicationId!: number;
  @IsEnum(InterviewType) type!: InterviewType;
  @IsDateString() scheduledAt!: string; // start
  @IsOptional() @IsDateString() endsAt?: string;
  @IsOptional() @IsInt() interviewerId?: number; // who conducts; defaults to scheduler
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() link?: string;
  @IsOptional() @IsString() notes?: string;
}

@Controller('interviews')
export class InterviewsController {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private activity: ActivityService,
  ) {}

  /** Staff schedules an interview; application auto-advances to INTERVIEW
   *  and the candidate gets a notification. */
  @Post()
  @Roles(...STAFF)
  async schedule(@CurrentUser() user: User, @Body() dto: ScheduleDto) {
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: { job: true },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (!user.isSuperadmin) {
      if (user.role === Role.HIRING_MANAGER) {
        if (app.job.hiringManagerId !== user.id) {
          throw new ForbiddenException('Not assigned to this job');
        }
      } else if (app.job.companyId !== user.companyId) {
        throw new ForbiddenException('Not your company\'s job');
      }
    }
    const terminal: ApplicationStatus[] = [
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
    ];
    if (terminal.includes(app.status)) {
      throw new BadRequestException(`Cannot schedule for a ${app.status} application`);
    }
    if (dto.endsAt && new Date(dto.endsAt) <= new Date(dto.scheduledAt)) {
      throw new BadRequestException('End time must be after start time');
    }
    if (dto.type === InterviewType.ONLINE && !dto.link) {
      throw new BadRequestException('Online interviews need a meeting link');
    }
    if (dto.interviewerId) {
      const iv = await this.prisma.user.findUnique({ where: { id: dto.interviewerId } });
      const staffRoles: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];
      if (!iv || iv.companyId !== app.job.companyId || !staffRoles.includes(iv.role)) {
        throw new BadRequestException('Interviewer must be staff at this company');
      }
    }

    const [interview] = await this.prisma.$transaction([
      this.prisma.interview.create({
        data: {
          applicationId: app.id,
          scheduledById: user.id,
          interviewerId: dto.interviewerId,
          type: dto.type,
          scheduledAt: new Date(dto.scheduledAt),
          endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
          location: dto.location,
          link: dto.link,
          notes: dto.notes,
        },
      }),
      this.prisma.application.update({
        where: { id: app.id },
        data: { status: ApplicationStatus.INTERVIEW },
      }),
      this.prisma.applicationStatusHistory.create({
        data: {
          applicationId: app.id,
          fromStatus: app.status,
          toStatus: ApplicationStatus.INTERVIEW,
          changedById: user.id,
        },
      }),
    ]);
    await this.notifications.notify(app.candidateId, 'interview.scheduled', {
      applicationId: app.id,
      jobTitle: app.job.title,
      type: dto.type,
      scheduledAt: dto.scheduledAt,
      location: dto.location,
      link: dto.link,
    });
    // The interviewer gets notified too when they aren't the scheduler.
    if (dto.interviewerId && dto.interviewerId !== user.id) {
      await this.notifications.notify(dto.interviewerId, 'interview.assigned', {
        applicationId: app.id,
        jobTitle: app.job.title,
        scheduledAt: dto.scheduledAt,
      });
    }
    await this.activity.log(user.id, 'interview.scheduled', 'interview', interview.id);
    return interview;
  }

  /** Candidate's own interview schedule. */
  @Get('mine')
  @Roles(Role.CANDIDATE)
  mine(@CurrentUser() user: User) {
    return this.prisma.interview.findMany({
      where: { application: { candidateId: user.id } },
      include: {
        interviewer: { select: { fullName: true } },
        scheduledBy: { select: { fullName: true } },
        application: {
          include: { job: { include: { company: { select: { name: true } } } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
