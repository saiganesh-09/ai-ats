/**
 * Seed: realistic demo data so dashboards/charts/pipelines aren't empty.
 * Run: npx prisma db seed
 */
import {
  ApplicationStatus,
  EmploymentType,
  ExperienceLevel,
  JobStatus,
  PrismaClient,
  Role,
  WorkMode,
} from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();
const pw = () => argon2.hash('password123');

const upsertSkill = (name: string) =>
  prisma.skill.upsert({
    where: { name },
    create: { name },
    update: {},
  }).then((s) => ({ id: s.id }));

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
      employmentType: EmploymentType.FULL_TIME,
      experienceLevel: ExperienceLevel.SENIOR,
      workMode: WorkMode.REMOTE,
      salaryMin: 130000, salaryMax: 170000,
      educationRequirement: 'BS in CS or equivalent experience',
      openings: 2,
      status: JobStatus.PUBLISHED,
      skills: {
        create: await Promise.all(
          ['typescript', 'node', 'postgresql', 'docker', 'rest'].map(
            async (n) => ({ skill: { connect: await upsertSkill(n) } }),
          ),
        ),
      },
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
      employmentType: EmploymentType.FULL_TIME,
      experienceLevel: ExperienceLevel.MID,
      workMode: WorkMode.HYBRID,
      salaryMin: 110000, salaryMax: 140000,
      openings: 1,
      status: JobStatus.PUBLISHED,
      skills: {
        create: await Promise.all(
          ['react', 'typescript', 'next.js', 'tailwind'].map(
            async (n) => ({ skill: { connect: await upsertSkill(n) } }),
          ),
        ),
      },
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
        profile: { create: { headline: c.text.split('\n')[1] } },
        experiences: {
          create: [{ title: 'Software Engineer', company: 'Previous Co', years: 3 }],
        },
        educations: {
          create: [{ degree: 'BS Computer Science', institution: 'State University', year: 2020 }],
        },
        skills: {
          create: await Promise.all(
            c.skills.map(async (name) => ({
              skill: { connect: await upsertSkill(name) },
              source: 'resume',
            })),
          ),
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
          interviewerId: hiringManager.id,
          type: 'ONLINE',
          scheduledAt: new Date(Date.now() + 3 * 86400_000),
          endsAt: new Date(Date.now() + 3 * 86400_000 + 3600_000),
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

  // --- second tenant: proves multi-tenancy + fills the public directory ---
  const techNova = await prisma.company.create({
    data: { name: 'TechNova', inviteCode: 'technova-join-2026' },
  });
  const tnRecruiter = await prisma.user.create({
    data: {
      email: 'sam@technova.io', fullName: 'Sam Staffer', passwordHash,
      role: Role.RECRUITER, companyId: techNova.id,
    },
  });
  const tnJobs = [
    {
      title: 'Full Stack Developer', location: 'San Francisco, CA',
      description: 'React + Node across the stack. TypeScript, PostgreSQL, GraphQL, Docker.',
      requirements: 'React, Node, TypeScript, GraphQL',
      employmentType: EmploymentType.FULL_TIME,
      experienceLevel: ExperienceLevel.MID, workMode: WorkMode.HYBRID,
      salaryMin: 125000, salaryMax: 155000,
      skills: ['react', 'node', 'typescript', 'graphql'],
    },
    {
      title: 'Data Analyst', location: 'Remote',
      description: 'Own our metrics layer. SQL, Python, pandas, dashboards for the exec team.',
      requirements: 'SQL, Python, pandas',
      employmentType: EmploymentType.CONTRACT,
      experienceLevel: ExperienceLevel.ENTRY, workMode: WorkMode.REMOTE,
      salaryMin: 85000, salaryMax: 110000,
      skills: ['sql', 'python', 'pandas'],
    },
    {
      title: 'DevOps Engineer', location: 'Seattle, WA',
      description: 'Kubernetes, AWS, CI/CD pipelines, Terraform. On-call rotation.',
      requirements: 'Kubernetes, AWS, Docker, CI/CD, Linux',
      employmentType: EmploymentType.FULL_TIME,
      experienceLevel: ExperienceLevel.SENIOR, workMode: WorkMode.ONSITE,
      salaryMin: 145000, salaryMax: 185000,
      skills: ['kubernetes', 'aws', 'docker', 'ci/cd', 'linux'],
    },
  ];
  const createdTnJobs = [];
  for (const j of tnJobs) {
    createdTnJobs.push(await prisma.job.create({
      data: {
        companyId: techNova.id, recruiterId: tnRecruiter.id,
        title: j.title, location: j.location,
        description: j.description, requirements: j.requirements,
        employmentType: j.employmentType, experienceLevel: j.experienceLevel,
        workMode: j.workMode, salaryMin: j.salaryMin, salaryMax: j.salaryMax,
        status: JobStatus.PUBLISHED,
        skills: {
          create: await Promise.all(j.skills.map(
            async (n) => ({ skill: { connect: await upsertSkill(n) } }),
          )),
        },
      },
    }));
  }

  // One more candidate + cross-tenant applications so every funnel stage has data.
  const fiona = await prisma.user.create({
    data: {
      email: 'fiona@example.com', fullName: 'Fiona Fullstack', passwordHash,
      role: Role.CANDIDATE,
      profile: { create: { headline: 'Full-stack dev, React + Node, 4 years' } },
      experiences: { create: [{ title: 'Full Stack Engineer', company: 'StartupCo', years: 4 }] },
      educations: { create: [{ degree: 'BS Software Engineering', institution: 'Tech U', year: 2021 }] },
      skills: {
        create: await Promise.all(
          ['react', 'node', 'typescript', 'graphql', 'docker'].map(async (n) => ({
            skill: { connect: await upsertSkill(n) }, source: 'resume',
          })),
        ),
      },
    },
  });
  const fionaResume = await prisma.resume.create({
    data: {
      candidateId: fiona.id, originalFilename: 'fiona-resume.txt',
      storageKey: `resumes/seed-${fiona.id}.txt`,
      rawText: 'Fiona Fullstack\nReact, Node, TypeScript, GraphQL, Docker. 4 years.',
      parsed: { summary: 'Full-stack dev', skills: ['react', 'node', 'typescript', 'graphql', 'docker'], experience: [], education: [] },
    },
  });
  const extraApps = [
    { user: fiona, resume: fionaResume, job: createdTnJobs[0].id, status: ApplicationStatus.HIRED, score: 91 },
    { user: resumes[0].user, resume: resumes[0].resume, job: createdTnJobs[2].id, status: ApplicationStatus.SCREENING, score: 71 },
    { user: resumes[1].user, resume: resumes[1].resume, job: createdTnJobs[0].id, status: ApplicationStatus.SCREENING, score: 58 },
    { user: resumes[2].user, resume: resumes[2].resume, job: createdTnJobs[1].id, status: ApplicationStatus.APPLIED, score: 45 },
  ];
  for (const a of extraApps) {
    await prisma.application.create({
      data: {
        jobId: a.job, candidateId: a.user.id, resumeId: a.resume.id,
        status: a.status, matchScore: a.score,
        matchDetails: {
          score: a.score, matched_skills: ['typescript'],
          missing_skills: [], explanation: 'Seed data — run Score for a real analysis.',
        },
      },
    });
    await prisma.notification.create({
      data: {
        userId: a.user.id, type: 'application.status',
        payload: { status: a.status },
      },
    });
  }

  console.log('Seeded: 2 companies, 5 staff users, 4 candidates, 6 published jobs, 9 applications');
  console.log('Logins (all password123): admin@acme.com rita@acme.com henry@acme.com super@ats.dev sam@technova.io carol@example.com dave@example.com erin@example.com fiona@example.com');
  console.log('Company invite codes: acme-join-2026, technova-join-2026');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
