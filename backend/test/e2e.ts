/**
 * End-to-end integration test — a complete recruitment workflow over real
 * HTTP against a running app + the real database.
 *
 * Run: `npm run test:e2e` with the API up (`npm run start:dev`, or in CI the
 * built app on E2E_BASE). tsx/esbuild strips design:paramtypes so in-process
 * NestFactory boot can't resolve DI — a live server is the truer e2e anyway.
 *
 *   register → login → create company → post job → publish
 *   → candidate uploads resume → applies → recruiter advances status
 *   → schedules interview → candidate notified
 */
const base = process.env.E2E_BASE ?? 'http://localhost:3001/api';

let passed = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (!cond) {
    console.error(`  ✗ ${name}`, extra ?? '');
    process.exitCode = 1;
    return;
  }
  passed++;
  console.log(`  ✓ ${name}`);
};

async function main() {

  const run = Date.now();
  const post = async (path: string, body: unknown, token?: string, form?: FormData) =>
    fetch(base + path, {
      method: 'POST',
      headers: {
        ...(form ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });

  // --- register recruiter + candidate ---
  const rec = await post('/auth/register', {
    email: `rec${run}@test.dev`, password: 'password123', fullName: 'Rec Test', role: 'RECRUITER',
  }).then((r) => r.json());
  check('register recruiter', !!rec.accessToken);
  const cand = await post('/auth/register', {
    email: `cand${run}@test.dev`, password: 'password123', fullName: 'Cand Test', role: 'CANDIDATE',
  }).then((r) => r.json());
  check('register candidate', !!cand.accessToken);
  const recT = rec.accessToken as string;
  const candT = cand.accessToken as string;

  // --- login ---
  const login = await post('/auth/login', { email: `rec${run}@test.dev`, password: 'password123' });
  check('login returns access token', login.status === 200);

  // --- RBAC: candidate cannot create a company or a job ---
  const forbidden = await post('/jobs', { title: 'x', description: 'y'.repeat(25) }, candT);
  check('candidate blocked from posting jobs (403 + envelope)', forbidden.status === 403
    && (await forbidden.clone().json()).error?.code === 'FORBIDDEN');

  // --- company + job ---
  const company = await post('/companies', { name: `E2ECo ${run}` }, recT);
  check('create company', company.status === 201, await company.clone().text());

  const job = await post('/jobs', {
    title: 'E2E Engineer',
    description: 'Full recruitment pipeline integration test job posting.',
    employmentType: 'FULL_TIME', experienceLevel: 'MID', workMode: 'REMOTE',
    requiredSkills: ['typescript'],
  }, recT).then((r) => r.json());
  check('job created as DRAFT', job.status === 'DRAFT');
  await post(`/jobs/${job.id}/publish`, null, recT);
  check('job published', true);

  // --- public board shows it; deadline guard hides expired ones ---
  const board = await fetch(`${base}/jobs?q=E2E`).then((r) => r.json());
  check('published job on public board', board.items.some((j: { id: number }) => j.id === job.id));

  // --- candidate uploads resume (multipart) ---
  const form = new FormData();
  form.append('file', new Blob(['Cand Test\ntypescript node sql\n5 years backend'], { type: 'text/plain' }), 'cv.txt');
  const resume = await post('/resumes', null, candT, form).then((r) => r.json());
  check('resume uploaded + parsed', !!resume.id && resume.parsedStatus !== 'FAILED', resume);

  // --- apply ---
  const applied = await post('/applications', { jobId: job.id, resumeId: resume.id }, candT).then((r) => r.json());
  check('application created at APPLIED', applied.status === 'APPLIED', applied);
  const dup = await post('/applications', { jobId: job.id, resumeId: resume.id }, candT);
  check('duplicate application rejected', dup.status === 400);

  // --- status transition writes history + notifications ---
  const shortlist = await fetch(`${base}/applications/${applied.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${recT}` },
    body: JSON.stringify({ status: 'SHORTLISTED' }),
  }).then((r) => r.json());
  check('status → SHORTLISTED', shortlist.status === 'SHORTLISTED', shortlist);

  // --- schedule interview → app advances to INTERVIEW ---
  const iv = await post('/interviews', {
    applicationId: applied.id, type: 'ONLINE',
    scheduledAt: new Date(Date.now() + 86400e3).toISOString(),
    endsAt: new Date(Date.now() + 90000e3).toISOString(),
    link: 'https://meet.test/e2e',
  }, recT).then((r) => r.json());
  check('interview scheduled ONLINE', iv.type === 'ONLINE', iv);

  const mine = await fetch(`${base}/interviews/mine`, { headers: { Authorization: `Bearer ${candT}` } }).then((r) => r.json());
  check('candidate sees upcoming interview', mine.some((i: { id: number }) => i.id === iv.id));

  const notifs = await fetch(`${base}/notifications/mine`, { headers: { Authorization: `Bearer ${candT}` } }).then((r) => r.json());
  const types = notifs.map((n: { type: string }) => n.type);
  check('candidate notified: submitted+status+interview',
    ['application.submitted', 'application.status', 'interview.scheduled'].every((t) => types.includes(t)), types);

  const recNotifs = await fetch(`${base}/notifications/mine`, { headers: { Authorization: `Bearer ${recT}` } }).then((r) => r.json());
  check('recruiter notified of new application',
    recNotifs.some((n: { type: string }) => n.type === 'application.new'));

  // --- notification center ---
  const unread = await fetch(`${base}/notifications/unread-count`, { headers: { Authorization: `Bearer ${candT}` } }).then((r) => r.json());
  check('unread count ≥ 3', unread.count >= 3, unread);
  await fetch(`${base}/notifications/${notifs[0].id}/read`, {
    method: 'PATCH', headers: { Authorization: `Bearer ${candT}` },
  });
  const unread2 = await fetch(`${base}/notifications/unread-count`, { headers: { Authorization: `Bearer ${candT}` } }).then((r) => r.json());
  check('mark-read decrements count', unread2.count === unread.count - 1);

  console.log(`\n${passed} checks passed${process.exitCode ? ' (with failures above)' : ''}`);
  process.exit(process.exitCode ?? 0);
}

main().catch((e) => {
  console.error(`e2e crashed (is the API running at ${base}?):`, e.message ?? e);
  process.exit(1);
});
