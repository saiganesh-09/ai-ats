# Project Overview

**AI ATS** is a multi-tenant applicant tracking system — the software a
company uses to collect job applications and move candidates through a
hiring pipeline, with AI assistance for resume parsing and match scoring.

## The problem

Hiring involves four different kinds of users with different needs:
candidates want to apply and track status, recruiters want to triage a
pipeline, hiring managers want to review only their own requisitions, and
admins want platform oversight. Generic tools leak data across companies
and make recruiting a spreadsheet exercise; this project builds the real
shape.

## The solution

A full-stack SaaS app:

- **Candidates** search/filter jobs, upload resumes (AI-parsed into
  structured profiles), apply, track pipeline status, get interview
  schedules and notifications.
- **Recruiters** post jobs through a lifecycle, run a drag-and-drop kanban
  pipeline, score candidates with an AI estimate, generate summaries and
  interview questions, schedule interviews.
- **Hiring managers** review only their assigned jobs' candidates and leave
  feedback.
- **Admins** manage users/companies/jobs, moderate reports, and audit the
  platform.

## What makes it production-style

- Multi-tenant data isolation at the query layer (every query is
  tenant-scoped, hiring-manager queries are row-scoped)
- Real auth: rotating refresh tokens, argon2id, RBAC guards
- Real infrastructure seams: storage and email behind interfaces
  (local/console now, S3/SMTP by config)
- Append-only audit trails: status history + activity log
- Tests at three layers, Docker for dev, CI on every push
- AI framed as decision-support, never decision-making

## Numbers

64 REST endpoints · 20 tables · 4 roles · 9 notification types ·
6 AI features · 25 unit + 18 e2e + 5 frontend tests · 3 containers.
