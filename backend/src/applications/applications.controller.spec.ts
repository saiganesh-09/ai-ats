import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, JobStatus, Role, type User } from '@prisma/client';
import { ApplicationsController } from './applications.controller';
import { ActivityService } from '../activity/activity.service';
import { AiService } from '../ai/ai.service';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.controller';
import { PrismaService } from '../prisma/prisma.service';

const prisma = {
  job: { findUnique: jest.fn() },
  resume: { findUnique: jest.fn() },
  application: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  applicationStatusHistory: { create: jest.fn() },
} as unknown as PrismaService;

const ai = {} as AiService;
const activity = { log: jest.fn() } as unknown as ActivityService;
const notifications = { notify: jest.fn() } as unknown as NotificationsService;
const email = {
  applicationConfirmation: jest.fn(),
  statusUpdate: jest.fn(),
  offerNotification: jest.fn(),
} as unknown as EmailService;

const svc = () =>
  new ApplicationsController(prisma, ai, activity, notifications, email);

const candidate = {
  id: 5,
  email: 'c@c.co',
  fullName: 'Carol',
  role: Role.CANDIDATE,
} as User;

describe('ApplicationsController', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('apply', () => {
    it('rejects a non-published job', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        status: JobStatus.DRAFT,
      });
      await expect(
        svc().apply(candidate, { jobId: 1, resumeId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an expired deadline even when still PUBLISHED', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        status: JobStatus.PUBLISHED,
        applicationDeadline: new Date('2020-01-01'),
      });
      await expect(
        svc().apply(candidate, { jobId: 1, resumeId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects a resume owned by another candidate', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        status: JobStatus.PUBLISHED,
      });
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue({
        candidateId: 99,
      });
      await expect(
        svc().apply(candidate, { jobId: 1, resumeId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the application + history + notifications on success', async () => {
      (prisma.job.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: JobStatus.PUBLISHED,
        title: 'Eng',
        recruiterId: 9,
      });
      (prisma.resume.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        candidateId: 5,
      });
      (prisma.application.create as jest.Mock).mockResolvedValue({ id: 42 });
      await svc().apply(candidate, { jobId: 1, resumeId: 1 });
      expect(prisma.applicationStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ toStatus: 'APPLIED' }),
        }),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        5,
        'application.submitted',
        expect.any(Object),
      );
      expect(notifications.notify).toHaveBeenCalledWith(
        9,
        'application.new',
        expect.any(Object),
      );
    });
  });

  describe('withdraw', () => {
    const withdraw = (status: ApplicationStatus) => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status,
        candidateId: 5,
        job: { recruiterId: 9, title: 'Eng' },
      });
      return svc().withdraw(candidate, 1);
    };

    it.each([ApplicationStatus.APPLIED, ApplicationStatus.SCREENING])(
      'allows withdrawal from %s',
      async (status) => {
        (prisma.application.update as jest.Mock).mockResolvedValue({
          status: 'WITHDRAWN',
        });
        await expect(withdraw(status)).resolves.toBeDefined();
      },
    );

    it.each([
      ApplicationStatus.OFFER,
      ApplicationStatus.HIRED,
      ApplicationStatus.REJECTED,
    ])('blocks withdrawal from %s', async (status) => {
      await expect(withdraw(status)).rejects.toThrow(BadRequestException);
    });

    it("rejects another candidate's application", async () => {
      (prisma.application.findUnique as jest.Mock).mockResolvedValue({
        id: 1,
        status: 'APPLIED',
        candidateId: 99,
      });
      await expect(svc().withdraw(candidate, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
