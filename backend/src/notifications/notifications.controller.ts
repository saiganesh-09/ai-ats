import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Injectable,
} from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  /** Other modules call this to fan out notifications (status changes, interviews). */
  async notify(userId: number, type: string, payload?: Prisma.InputJsonValue) {
    await this.prisma.notification.create({ data: { userId, type, payload } });
  }
}

@Controller('notifications')
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get('mine')
  mine(@CurrentUser() user: User) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: User) {
    const count = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId: user.id },
      data: { readAt: new Date() },
    });
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: User) {
    return this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
