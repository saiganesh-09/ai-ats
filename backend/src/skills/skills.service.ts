import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const VOCAB = [
  'python',
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node',
  'express',
  'nestjs',
  'fastapi',
  'django',
  'sql',
  'postgresql',
  'mysql',
  'mongodb',
  'redis',
  'docker',
  'kubernetes',
  'aws',
  'gcp',
  'azure',
  'git',
  'ci/cd',
  'rest',
  'graphql',
  'machine learning',
  'pandas',
  'java',
  'go',
  'rust',
  'c++',
  'html',
  'css',
  'tailwind',
  'prisma',
  'linux',
  'agile',
];

/**
 * Canonical skills taxonomy. Skills are upserted (lowercase, deduped) so the
 * whole platform shares one vocabulary — that's what makes candidate↔job
 * matching a set intersection instead of string matching.
 */
@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  /** Find known skills mentioned in free text (used for jobs + resume fallback). */
  extractFromText(text: string): string[] {
    const lowered = text.toLowerCase();
    return VOCAB.filter((s) =>
      new RegExp(`\\b${s.replace(/[+.]/g, '\\$&')}\\b`).test(lowered),
    );
  }

  async upsertMany(names: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const raw of names) {
      const name = raw.trim().toLowerCase();
      if (!name) continue;
      const skill = await this.prisma.skill.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      map.set(name, skill.id);
    }
    return map;
  }

  /** Replace a job's skill links — required vs preferred is a flag on the join. */
  async syncJobSkills(
    jobId: number,
    required: string[],
    preferred: string[] = [],
  ) {
    const reqIds = await this.upsertMany(required);
    const prefIds = await this.upsertMany(
      preferred.filter((p) => !reqIds.has(p.trim().toLowerCase())), // required wins
    );
    await this.prisma.$transaction([
      this.prisma.jobSkill.deleteMany({ where: { jobId } }),
      this.prisma.jobSkill.createMany({
        data: [
          ...[...reqIds.values()].map((skillId) => ({
            jobId,
            skillId,
            required: true,
          })),
          ...[...prefIds.values()].map((skillId) => ({
            jobId,
            skillId,
            required: false,
          })),
        ],
      }),
    ]);
  }

  /** Merge skills into a candidate's profile (resume upload adds, never removes). */
  async mergeCandidateSkills(
    userId: number,
    names: string[],
    source = 'manual',
  ) {
    const ids = await this.upsertMany(names);
    await this.prisma.candidateSkill.createMany({
      data: [...ids.values()].map((skillId) => ({ userId, skillId, source })),
      skipDuplicates: true,
    });
  }

  /** Replace a candidate's manual skill set (profile editor saves). */
  async syncCandidateSkills(userId: number, names: string[]) {
    const ids = await this.upsertMany(names);
    await this.prisma.$transaction([
      this.prisma.candidateSkill.deleteMany({ where: { userId } }),
      this.prisma.candidateSkill.createMany({
        data: [...ids.values()].map((skillId) => ({ userId, skillId })),
      }),
    ]);
  }
}
