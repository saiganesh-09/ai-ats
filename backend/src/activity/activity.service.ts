import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Audit trail. Key actions across the app call activity.log() — admins can
 * then monitor "who did what, when". Never throws: logging must not break
 * the action being logged.
 */
@Injectable()
export class ActivityService {
  constructor(private prisma: PrismaService) {}

  async log(
    actorId: number | null,
    action: string,
    entityType?: string,
    entityId?: number,
    metadata?: Prisma.InputJsonValue,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: { actorId, action, entityType, entityId, metadata },
      });
    } catch {
      // audit failure must never fail the request
    }
  }
}
