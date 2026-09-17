/**
 * Screenshot capture — real screens, real seeded data.
 * Usage: node scripts/screenshots.mjs  (needs dev servers on :3000/:3001)
 * Output: docs/screenshots/*.png
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const WEB = 'http://localhost:3000';
const API = 'http://localhost:3001/api';
const OUT = new URL('../docs/screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const login = async (email) =>
  fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  }).then((r) => r.json()).then((d) => d.accessToken);

const [candT, recT, adminT] = await Promise.all([
  login('carol@example.com'), login('rita@acme.com'), login('super@ats.dev'),
]);

// [name, url, token, action?]
const shots = [
  ['01-landing', '/', null],
  ['02-login', '/login', null],
  ['03-register', '/register', null],
  ['04-job-search', '/jobs', null],
  ['05-companies', '/companies', null],
  ['06-job-detail', '/jobs/1', null],
  ['07-candidate-dashboard', '/candidate', candT],
  ['08-candidate-profile', '/candidate/profile', candT],
  ['09-resume-upload', '/candidate/resume', candT],
  ['10-candidate-applications', '/candidate/applications', candT],
  ['11-candidate-interviews', '/candidate/interviews', candT],
  ['12-notifications', '/notifications', candT],
  ['13-recruiter-dashboard', '/recruiter/dashboard', recT],
  ['14-recruiter-jobs', '/recruiter/jobs', recT],
  ['15-job-creation', '/recruiter/jobs/create', recT],
  ['16-pipeline-kanban', '/recruiter/jobs/1', recT],
  ['17-applicant-ai-analysis', '/recruiter/applications/1', recT],
  ['18-recruiter-candidates', '/recruiter/candidates', recT],
  ['19-interview-schedule', '/recruiter/interviews', recT],
  ['20-admin-dashboard', '/admin/dashboard', adminT],
  ['21-admin-users', '/admin/users', adminT],
  ['22-admin-audit', '/admin/audit-logs', adminT],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const [name, url, token] of shots) {
  await page.goto(WEB + '/login'); // same-origin for localStorage
  await page.evaluate((t) => {
    t ? localStorage.setItem('ats_access_token', t) : localStorage.removeItem('ats_access_token');
  }, token);
  await page.goto(WEB + url, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(900); // charts/animations settle
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: false });
  console.log(`✓ ${name}`);
}
await browser.close();
console.log(`\n${shots.length} screenshots → docs/screenshots/`);
