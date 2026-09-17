import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
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
  async mine(
    @CurrentUser() user: User,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '25',
  ) {
    const where = { userId: user.id };
    const p = Math.max(1, Number(page) || 1);
    const size = Math.min(100, Math.max(1, Number(pageSize) || 25));
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * size,
        take: size,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page: p, pageSize: size, totalPages: Math.max(1, Math.ceil(total / size)) };
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
