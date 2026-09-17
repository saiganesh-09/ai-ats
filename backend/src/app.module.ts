import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { StringValue } from 'ms';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { RequestLoggingInterceptor } from './common/logging.interceptor';
import { CompaniesModule } from './companies/companies.module';
import { EmailModule } from './email/email.module';
import { InterviewsModule } from './interviews/interviews.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ResumesModule } from './resumes/resumes.module';
import { SkillsModule } from './skills/skills.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(), // powers the interview-reminder cron
    // Global rate limit: 100 req/min/IP. Auth endpoints override tighter.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue,
      },
    }),
    PrismaModule,
    SkillsModule,
    StorageModule,
    AiModule,
    ActivityModule,
    EmailModule,
    NotificationsModule,
    AuthModule,
    CompaniesModule,
    ProfilesModule,
    JobsModule,
    ResumesModule,
    ApplicationsModule,
    InterviewsModule,
    AnalyticsModule,
    AdminModule,
  ],
  providers: [
    // Guards run globally in this order: rate-limit, authenticate, authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Structured JSON request log — metadata only, never bodies/tokens.
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
  ],
})
export class AppModule {}
