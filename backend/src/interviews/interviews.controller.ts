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
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';
import { ApplicationStatus, Role, type User } from '@prisma/client';
import { ActivityService } from '../activity/activity.service';
import { CurrentUser, Roles } from '../common/decorators';
import { NotificationsService } from '../notifications/notifications.controller';
import { PrismaService } from '../prisma/prisma.service';

const STAFF: Role[] = [Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN];

class ScheduleDto {
  @IsInt() applicationId!: number;
  @IsDateString() scheduledAt!: string;
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

    const [interview] = await this.prisma.$transaction([
      this.prisma.interview.create({
        data: {
          applicationId: app.id,
          scheduledById: user.id,
          scheduledAt: new Date(dto.scheduledAt),
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
      scheduledAt: dto.scheduledAt,
      location: dto.location,
      link: dto.link,
    });
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
        application: {
          include: { job: { include: { company: { select: { name: true } } } } },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }
}
