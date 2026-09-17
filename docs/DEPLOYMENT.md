# Deployment Guide

Target layout: **Vercel** (Next.js) + **Render/Railway/AWS** (NestJS) +
**managed Postgres** + **S3** + optional **Docker**.

## Environment variables

| Var | Where | Notes |
|---|---|---|
| `DATABASE_URL` | backend | Managed PG connection string (Neon/RDS/Railway) |
| `JWT_SECRET` | backend | `openssl rand -hex 32` — never commit |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL_DAYS` | backend | Defaults fine |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | backend | Empty → mock AI mode |
| `CORS_ORIGIN` | backend | Your Vercel URL, e.g. `https://ats.vercel.app` |
| `STORAGE_DIR` | backend | Local dev only (S3 replaces it) |
| `NEXT_PUBLIC_API_URL` | frontend build | `https://api.example.com/api` — baked at build time |
| `PORT` | backend | Set by the platform |

## Frontend → Vercel

1. Import the repo, set root to `frontend/`.
2. Env: `NEXT_PUBLIC_API_URL=https://<your-api>/api`.
3. Deploy — Next.js is auto-detected, zero config needed.

## Backend → Render (or Railway)

1. New Web Service from repo, root `backend/`.
   - Either: **Docker** — uses `backend/Dockerfile` (runs `prisma migrate deploy` then starts).
   - Or: **Node** — build `npm ci && npx prisma generate && npm run build`, start `node dist/main.js`.
2. Set all backend env vars above.
3. Persistent disk is NOT needed — resumes belong in S3, not the container FS.

## Database → managed Postgres

Any Postgres 14+ works (Neon free tier, Railway plugin, RDS). Paste the
connection string into `DATABASE_URL`; `migrate deploy` runs on container start.

## Files → S3

Implement `ObjectStorage` (`backend/src/storage/storage.service.ts`) with
`@aws-sdk/client-s3`:

```ts
@Injectable()
export class S3StorageService implements ObjectStorage {
  private s3 = new S3Client({ region: process.env.AWS_REGION });
  put = (key: string, data: Buffer) =>
    this.s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key, Body: data })).then(() => {});
  get = async (key: string) =>
    Buffer.from(await (await this.s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: key }))).Body!.transformToByteArray());
}
```

Then swap one line in `storage.module.ts` (`useClass: S3StorageService`).
Better still for scale: return **presigned URLs** from the download endpoint
instead of streaming through the API.

## Docker (everything local)

```bash
docker compose up --build   # db + api + web, see docker-compose.yml
```

## Email

`EmailService` mirrors the storage abstraction: `MailProvider` interface with
`ConsoleMailProvider` (dev default — logs rendered HTML) and
`SmtpMailProvider` (nodemailer, activated by setting `SMTP_HOST`; creds via
`SMTP_USER`/`SMTP_PASS` env vars — never hard-coded).
Templates live in `backend/src/email/templates.ts`. Interview reminders run
via an hourly cron (`InterviewRemindersService`) ~24h before each interview,
deduped by `interviews.reminder_sent_at`. All sends are fire-and-forget —
an email outage never fails a business request.

## Production checklist

- [ ] `JWT_SECRET` rotated from dev value
- [ ] `CORS_ORIGIN` locked to the real frontend domain
- [ ] `OPENAI_API_KEY` set (or accept mock mode)
- [ ] Cookies: `secure` already on in prod (`NODE_ENV=production`) — requires HTTPS
- [ ] Postgres backups + SSL (`?sslmode=require` in DATABASE_URL)
- [ ] S3 bucket private; downloads via presigned URLs
