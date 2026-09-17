import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './common/decorators';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('meta')
@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  root() {
    return {
      name: 'AI ATS API',
      version: '1.0',
      docs: '/api/docs',
      health: '/api/health',
    };
  }

  /**
   * Liveness/readiness probe for deploy platforms and uptime monitors.
   * `db` is a real SELECT 1 — a process can be "up" while the database is
   * unreachable, and that distinction is exactly what this endpoint exists for.
   */
  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Health check — process + database liveness' })
  async health() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
