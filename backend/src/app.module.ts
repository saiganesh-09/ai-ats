import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { ActivityModule } from './activity/activity.module';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ApplicationsModule } from './applications/applications.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { CompaniesModule } from './companies/companies.module';
import { InterviewsModule } from './interviews/interviews.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfilesModule } from './profiles/profiles.module';
import { ResumesModule } from './resumes/resumes.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: {
        expiresIn: (process.env.JWT_ACCESS_TTL ?? '15m') as StringValue,
      },
    }),
    PrismaModule,
    StorageModule,
    AiModule,
    ActivityModule,
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
    // Guards run globally in this order: authenticate, then authorize.
    // Public routes opt out via @Public(); role-restricted via @Roles().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
