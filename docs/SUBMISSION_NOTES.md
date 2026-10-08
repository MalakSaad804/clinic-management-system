# Short notes for the portal (copy/paste, adjust to your own words)

Each submission = GitHub repo link + README + a note (60+ characters: what you did, what was hard, what you left out).
The portal also expects **at least 3 commits on at least 2 different days** — commit as you really work.

## Task 1 — Data model & API architecture
Designed Mongoose schemas for Patient, Doctor and Visit with required fields, validation, unique and compound indexes and virtuals (fullName, age), and built Express CRUD routes with Zod validation and correct status codes. Hardest part was deciding what blocks a delete (patients/doctors with visits). Left out: soft-delete for patients.

## Task 2 — JWT authentication & role-based middleware
Added bcrypt password hashing, login that issues a JWT with expiry plus rotating refresh tokens, a `protect` middleware and an `authorize(role)` middleware for admin/doctor/patient, and Jest/Supertest tests for login, invalid/expired tokens and role restrictions. Hardest was refresh-token rotation. Left out: password reset and 2FA.

## Task 3 — Calendar, visit notes & prescription uploads
Built a react-big-calendar page showing free slots and booked visits with drag-and-drop rescheduling, a booking form, visit notes, and prescription image upload (type, size and magic-byte validation on the server, private download route, thumbnails in React). Hardest was showing private images (token needed) and clash detection. Left out: cloud storage (local disk for now).

## Task 4 — Audit logging, reports & privacy-aware history
Implemented an append-only Audit model filled by Mongoose pre/post hooks (who, action, entity, changed field names, time), a MongoDB aggregation report of appointments per doctor per month, and a patient-history endpoint where patients see only their own data without private clinician notes while doctors see everything. Hardest was knowing the current user inside model hooks (solved with AsyncLocalStorage). Left out: old/new value snapshots.

## Task 5 — CI/CD, deploy & handover
Wrote a multi-stage Dockerfile, docker-compose files, a GitHub Actions pipeline (lint, tests with a MongoDB service, Docker build and smoke test, deploy to Render via a deploy hook with secrets in GitHub), render.yaml, a full README with env vars and deployment steps, an architecture diagram and a handover document with trade-offs. Hardest was the free-tier disk being ephemeral. Left out: real cloud storage and automated backups.

## Suggested commit plan (real work, real days)
```
Day 1: chore: project structure, env config      | feat: models and CRUD routes     | test: patient/doctor tests
Day 2: feat: JWT auth and role middleware        | feat: visits, slots, uploads     | feat: calendar UI
Day 3: feat: audit plugin and reports            | feat: privacy-aware history      | ci: Docker + GitHub Actions + docs
```
