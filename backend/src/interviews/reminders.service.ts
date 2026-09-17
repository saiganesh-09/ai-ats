import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.controller';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Interview reminders: hourly cron that emails+notifies candidates ~24h
 * before their interview. reminderSentAt dedupes — each interview reminds once.
 */
@Injectable()
export class InterviewRemindersService {
  private readonly logger = new Logger(InterviewRemindersService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async sendReminders() {
    const window = {
      gte: new Date(Date.now() + 23 * 3600e3),
      lte: new Date(Date.now() + 25 * 3600e3),
    };
    const due = await this.prisma.interview.findMany({
      where: { scheduledAt: window, reminderSentAt: null },
      include: {
        application: {
          include: {
            job: { select: { title: true } },
            candidate: { select: { id: true, email: true, fullName: true } },
          },
        },
      },
    });
    for (const iv of due) {
      const c = iv.application.candidate;
      this.email.interviewReminder(
        c.email, c.fullName, iv.application.job.title, iv.type, iv.scheduledAt, iv.link ?? undefined,
      );
      await this.notifications.notify(c.id, 'interview.reminder', {
        interviewId: iv.id,
        jobTitle: iv.application.job.title,
        scheduledAt: iv.scheduledAt.toISOString(),
      });
      await this.prisma.interview.update({
        where: { id: iv.id },
        data: { reminderSentAt: new Date() },
      });
    }
    if (due.length) this.logger.log(`Sent ${due.length} interview reminder(s)`);
  }
}
