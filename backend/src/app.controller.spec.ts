import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: jest.fn() };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('root returns API info', () => {
    expect(appController.root()).toMatchObject({ name: 'AI ATS API' });
  });

  it('health reports ok when the database answers', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    const res = await appController.health();
    expect(res.status).toBe('ok');
    expect(res.db).toBe('up');
  });

  it('health reports degraded when the database is unreachable', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    const res = await appController.health();
    expect(res.status).toBe('degraded');
    expect(res.db).toBe('down');
  });
});
