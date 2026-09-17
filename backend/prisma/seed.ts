/**
 * Seed: realistic demo data so dashboards/charts/pipelines aren't empty.
 * Run: npx prisma db seed
 */
import {
  ApplicationStatus,
  JobStatus,
  PrismaClient,
  Role,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const pw = () => argon2.hash('password123');

async function main() {
  const passwordHash = await pw();

  // --- company + staff ---
  const acme = await prisma.company.create({
    data: { name: 'Acme Corp', inviteCode: 'acme-join-2026' },
  });

  const [admin, recruiter, hiringManager] = await Promise.all([
    prisma.user.create({
      data: {
        email: 'admin@acme.com', fullName: 'Ada Admin', passwordHash,
        role: Role.ADMIN, companyId: acme.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'rita@acme.com', fullName: 'Rita Recruiter', passwordHash,
        role: Role.RECRUITER, companyId: acme.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'henry@acme.com', fullName: 'Henry Manager', passwordHash,
        role: Role.HIRING_MANAGER, companyId: acme.id,
      },
    }),
    prisma.user.create({
      data: {
        email: 'super@ats.dev', fullName: 'Platform Admin', passwordHash,
        role: Role.ADMIN, isSuperadmin: true,
      },
    }),
  ]);

  // --- jobs ---
  const backend = await prisma.job.create({
    data: {
      companyId: acme.id, recruiterId: recruiter.id,
      hiringManagerId: hiringManager.id,
      title: 'Backend Engineer', location: 'Remote',
      description:
        'Build and scale our TypeScript APIs. You will work with NestJS, ' +
        'PostgreSQL, Prisma, Docker and AWS. Strong SQL skills required.',
      requirements: 'TypeScript, Node, PostgreSQL, Docker, REST',
      status: JobStatus.OPEN,
    },
  });
  const frontend = await prisma.job.create({
    data: {
      companyId: acme.id, recruiterId: recruiter.id,
      title: 'Frontend Developer', location: 'New York, NY',
      description:
        'Own our Next.js app. React, TypeScript, Tailwind, data fetching ' +
        'with TanStack Query, charts with Recharts.',
      requirements: 'React, TypeScript, Next.js, Tailwind',
      status: JobStatus.OPEN,
    },
  });
  await prisma.job.create({
    data: {
      companyId: acme.id, recruiterId: admin.id,
      title: 'Data Analyst (draft)', location: 'Austin, TX',
      description: 'Draft posting — SQL, Python, pandas, dashboards.',
      status: JobStatus.DRAFT,
    },
  });

  // --- candidates + resumes ---
  const candidateData = [
    {
      email: 'carol@example.com', fullName: 'Carol Candidate',
      skills: ['typescript', 'node', 'postgresql', 'docker', 'rest'],
      text: 'Carol Candidate\nSenior backend dev. TypeScript, Node.js, PostgreSQL, Docker, REST APIs. 5 years.',
    },
    {
      email: 'dave@example.com', fullName: 'Dave Developer',
      skills: ['react', 'typescript', 'next.js', 'tailwind', 'css'],
      text: 'Dave Developer\nFrontend engineer. React, Next.js, TypeScript, Tailwind CSS. 3 years.',
    },
    {
      email: 'erin@example.com', fullName: 'Erin Engineer',
      skills: ['python', 'sql', 'docker', 'git'],
      text: 'Erin Engineer\nBackend Python dev moving to TypeScript. Python, SQL, Docker, Git. 4 years.',
    },
  ];

  const resumes = [];
  for (const c of candidateData) {
    const user = await prisma.user.create({
      data: {
        email: c.email, fullName: c.fullName, passwordHash, role: Role.CANDIDATE,
        profile: {
          create: {
            headline: c.text.split('\n')[1],
            skills: c.skills,
            experience: [{ title: 'Software Engineer', company: 'Previous Co', years: 3 }],
            education: [{ degree: 'BS Computer Science', institution: 'State University', year: 2020 }],
          },
        },
      },
    });
    const resume = await prisma.resume.create({
      data: {
        candidateId: user.id,
        originalFilename: `${c.fullName.split(' ')[0].toLowerCase()}-resume.txt`,
        storageKey: `resumes/seed-${user.id}.txt`,
        rawText: c.text,
        parsed: {
          summary: c.text.split('\n')[1],
          skills: c.skills,
          experience: [],
          education: [],
        },
      },
    });
    resumes.push({ user, resume });
  }

  // --- applications across the pipeline ---
  const apps = [
    { i: 0, job: backend.id, status: ApplicationStatus.INTERVIEW, score: 92 },
    { i: 1, job: backend.id, status: ApplicationStatus.SHORTLISTED, score: 64 },
    { i: 2, job: backend.id, status: ApplicationStatus.APPLIED, score: 55 },
    { i: 1, job: frontend.id, status: ApplicationStatus.OFFER, score: 88 },
    { i: 2, job: frontend.id, status: ApplicationStatus.REJECTED, score: 30 },
  ];
  for (const a of apps) {
    const { user, resume } = resumes[a.i];
    const application = await prisma.application.create({
      data: {
        jobId: a.job, candidateId: user.id, resumeId: resume.id,
        status: a.status, matchScore: a.score,
        matchDetails: {
          score: a.score,
          matched_skills: ['typescript', 'postgresql'],
          missing_skills: ['kubernetes'],
          explanation: 'Seed data — run Score for a real analysis.',
        },
        assignedRecruiterId: recruiter.id,
      },
    });
    if (a.status === ApplicationStatus.INTERVIEW) {
      await prisma.interview.create({
        data: {
          applicationId: application.id,
          scheduledById: recruiter.id,
          scheduledAt: new Date(Date.now() + 3 * 86400_000),
          link: 'https://meet.example.com/carol',
          notes: 'Technical round with Henry',
        },
      });
    }
    await prisma.notification.create({
      data: {
        userId: user.id, type: 'application.status',
        payload: { applicationId: application.id, status: a.status },
      },
    });
  }

  await prisma.note.create({
    data: {
      applicationId: 1, authorId: recruiter.id,
      text: 'Strong TypeScript background — fast-track to HM review.',
    },
  });
  await prisma.feedback.create({
    data: {
      applicationId: 1, authorId: hiringManager.id, rating: 4,
      text: 'Good systems knowledge. Would like deeper SQL experience.',
    },
  });

  console.log('Seeded: 1 company, 4 staff users, 3 candidates, 3 jobs, 5 applications');
  console.log('Logins (all password123): admin@acme.com rita@acme.com henry@acme.com super@ats.dev carol@example.com dave@example.com erin@example.com');
  console.log('Company invite code: acme-join-2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
