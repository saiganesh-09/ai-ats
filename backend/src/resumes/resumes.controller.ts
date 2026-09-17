import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Role, type User } from '@prisma/client';
import { extractText } from 'unpdf';
import { ActivityService } from '../activity/activity.service';
import { AiService } from '../ai/ai.service';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SkillsService } from '../skills/skills.service';
import { resumeKey, STORAGE, type ObjectStorage } from '../storage/storage.service';

const MAX_SIZE = 5 * 1024 * 1024;

@Controller('resumes')
export class ResumesController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private activity: ActivityService,
    private skills: SkillsService,
    @Inject(STORAGE) private storage: ObjectStorage,
  ) {}

  /**
   * Upload pipeline: file → object storage (key, not path) → text extraction
   * → AI parse → DB row with raw text + parsed JSON → merge skills into profile.
   */
  @Post()
  @Roles(Role.CANDIDATE)
  @UseInterceptors(FileInterceptor('file'))
  async upload(@CurrentUser() user: User, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    if (file.size > MAX_SIZE) throw new BadRequestException('File too large (max 5MB)');

    const rawText = await this.extract(file);
    const key = resumeKey(file.originalname);
    await this.storage.put(key, file.buffer);

    const parsed = await this.ai.parseResume(rawText);
    const resume = await this.prisma.resume.create({
      data: {
        candidateId: user.id,
        originalFilename: file.originalname,
        storageKey: key,
        rawText,
        parsed: parsed as object,
      },
    });

    // Parse once, candidate edits after: merge extracted skills into the
    // normalized skills taxonomy (source='resume' tracks provenance).
    if (parsed.skills?.length) {
      await this.skills.mergeCandidateSkills(user.id, parsed.skills, 'resume');
    }

    await this.activity.log(user.id, 'resume.uploaded', 'resume', resume.id);
    return resume;
  }

  @Get('mine')
  @Roles(Role.CANDIDATE)
  mine(@CurrentUser() user: User) {
    return this.prisma.resume.findMany({
      where: { candidateId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete(':id')
  @Roles(Role.CANDIDATE)
  @HttpCode(204)
  async remove(@CurrentUser() user: User, @Param('id', ParseIntPipe) id: number) {
    const resume = await this.prisma.resume.findUnique({ where: { id } });
    if (!resume || resume.candidateId !== user.id) {
      throw new NotFoundException('Resume not found');
    }
    if (await this.prisma.application.count({ where: { resumeId: id } })) {
      throw new BadRequestException('Resume is attached to an application');
    }
    await this.prisma.resume.delete({ where: { id } });
  }

  /**
   * Download: owner, or staff whose company received an application that used
   * this resume. Streams from object storage — swap to an S3 presigned URL
   * redirect when the storage backend changes.
   */
  @Get(':id/download')
  @Roles(Role.CANDIDATE, Role.RECRUITER, Role.HIRING_MANAGER, Role.ADMIN)
  async download(
    @CurrentUser() user: User,
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const resume = await this.prisma.resume.findUnique({ where: { id } });
    if (!resume) throw new NotFoundException('Resume not found');

    if (resume.candidateId !== user.id && !user.isSuperadmin) {
      const used = await this.prisma.application.findFirst({
        where: { resumeId: id, job: { companyId: user.companyId ?? -1 } },
      });
      if (!used) throw new ForbiddenException('No access to this resume');
    }

    const data = await this.storage.get(resume.storageKey);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${resume.originalFilename}"`,
    });
    res.send(data);
  }

  private async extract(file: Express.Multer.File): Promise<string> {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.txt')) return file.buffer.toString('utf-8');
    if (name.endsWith('.pdf')) {
      const { text } = await extractText(new Uint8Array(file.buffer));
      const joined = Array.isArray(text) ? text.join('\n') : String(text);
      if (!joined.trim()) {
        throw new UnprocessableEntityException('Could not extract text (scanned PDF?)');
      }
      return joined;
    }
    throw new UnprocessableEntityException('Only .pdf and .txt resumes are supported');
  }
}
