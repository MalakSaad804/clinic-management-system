# Clinic Patient Management System — Brew & Bean Cafe

A secure MERN-stack (MongoDB, Express, React, Node.js) application that manages **patients, doctors, appointments, visit notes, prescription uploads and audit logs** for the small on-site health clinic at Brew & Bean Cafe.

| Layer | What it uses |
|---|---|
| API | Node.js 20, Express 4, Mongoose 8, Zod (validation), JWT + bcrypt, Multer (uploads), Helmet, rate-limit |
| Frontend | React 18, Vite, React Router, react-big-calendar (drag & drop), Axios |
| Quality | Jest + Supertest tests (≥ 80 % coverage gate), ESLint |
| DevOps | Docker (multi-stage), GitHub Actions CI/CD, Render deployment |

---

## 1. Quick start (local)

**Needs:** Node.js 18+ and a MongoDB (local, Docker, or free MongoDB Atlas).

```bash
# 1) API
cd backend
cp .env.example .env          # then edit the secrets
npm install
npm run seed                  # optional: demo doctors, patients, visits
npm run dev                   # http://localhost:5000

# 2) Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173  (proxies /api to :5000)
```

Demo logins created by `npm run seed` (password `Password123`):

| Role | Email |
|---|---|
| Admin | `admin@brewbean.test` |
| Doctor | `ayesha.khan@brewbean.test` |
| Patient | `sara.ali@example.com` |

**Or with Docker only:** `docker compose up --build` → open http://localhost:5000, then `docker compose exec app node scripts/seed.js`.

---

## 2. Environment variables (`backend/.env`)

| Variable | Required | Default | Meaning |
|---|---|---|---|
| `NODE_ENV` | – | `development` | `production` enables strict checks |
| `PORT` | – | `5000` | HTTP port (Render sets it automatically) |
| `MONGO_URI` | **prod** | `mongodb://127.0.0.1:27017/clinic` | MongoDB connection string |
| `JWT_SECRET` | **prod** | dev-only value | Signs access tokens |
| `JWT_REFRESH_SECRET` | **prod** | dev-only value | Signs refresh tokens (must differ) |
| `ACCESS_TOKEN_EXPIRES_IN` | – | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_IN` | – | `7d` | Refresh token lifetime |
| `BCRYPT_ROUNDS` | – | `12` | Password hashing cost |
| `CORS_ORIGIN` | – | `http://localhost:5173` | Allowed frontend origin(s), comma separated |
| `UPLOAD_DIR` | – | `uploads` | Where prescription images are stored |
| `MAX_UPLOAD_MB` | – | `5` | Max prescription size |
| `CLINIC_TZ_OFFSET_MINUTES` | – | `300` | Clinic time zone (Pakistan = UTC+5) |
| `FRONTEND_DIST` | – | – | Path of built React app to serve (set by Docker) |
| `MONGO_URI_TEST` | tests | in-memory MongoDB | Database used by the tests |

In production the server **refuses to start** if `JWT_SECRET`, `JWT_REFRESH_SECRET` or `MONGO_URI` is missing.

---

## 3. Roles and permissions

| | Admin | Doctor | Patient |
|---|:-:|:-:|:-:|
| Manage user accounts, doctors (create/edit/delete) | ✅ | – | – |
| Create / edit patients, list & search patients | ✅ | ✅ | – |
| Delete patients / visits | ✅ | – | – |
| Schedule visits, write notes, upload prescriptions | ✅ (any doctor) | ✅ (own visits) | – |
| Reports & dashboard | ✅ all | ✅ own numbers only | – |
| Audit log | ✅ | – | – |
| View patient record & history | ✅ full | ✅ full | **own only**, without private clinician notes |

---

## 4. API documentation

Base URL: `/api` · Send `Authorization: Bearer <accessToken>` on everything except `/auth/register`, `/auth/login`, `/auth/refresh` and `/health`.
Responses are JSON: `{ "success": true, "data": …, "meta": { total, page, limit, pages } }`; errors are `{ "success": false, "message": "…", "details": [ {field, message} ] }`.
More examples: [`docs/API.md`](docs/API.md).

### Auth
| Method & path | Who | Description | Success | Errors |
|---|---|---|---|---|
| `POST /auth/register` | public | Patient self sign-up (creates patient record + login) | 201 | 400, 409 |
| `POST /auth/login` | public | Returns `accessToken` (with expiry) + `refreshToken` | 200 | 400, 401 |
| `POST /auth/refresh` | public | Swap a refresh token for new tokens (rotation) | 200 | 401 |
| `POST /auth/logout` | any | Invalidates the refresh token | 200 | 401 |
| `GET /auth/me` | any | Current user | 200 | 401 |

### Users (admin)
| `GET /users` · `POST /users` · `PATCH /users/:id` | admin | List, create (doctor/admin/patient login), enable/disable | 200/201 | 400, 403, 404 |
|---|---|---|---|---|

### Patients
| Method & path | Who | Description | Success | Errors |
|---|---|---|---|---|
| `GET /patients?q=&page=&limit=` | admin, doctor | Search + paginate | 200 | 400, 403 |
| `POST /patients` | admin, doctor | Create | 201 | 400, 409 (duplicate email) |
| `GET /patients/:id` | staff; patient (own only) | Read one | 200 | 400, 403, 404 |
| `PATCH /patients/:id` | admin, doctor | Partial update | 200 | 400, 404, 409 |
| `DELETE /patients/:id` | admin | Delete (blocked if visits exist) | 200 | 404, 409 |
| `GET /patients/:id/history` | staff (full); patient (own, filtered) | Privacy-aware visit history | 200 | 403, 404 |

### Doctors
| `GET /doctors` · `GET /doctors/:id` | any logged-in | List / read | 200 | 404 |
|---|---|---|---|---|
| `POST /doctors` · `PATCH /doctors/:id` · `DELETE /doctors/:id` | admin | Create / update / delete (blocked if visits exist) | 201/200 | 400, 404, 409 |

### Visits & prescriptions
| Method & path | Who | Description | Success | Errors |
|---|---|---|---|---|
| `GET /visits?from=&to=&doctor=&patient=&status=` | any (patients see own only) | Calendar data | 200 | 400 |
| `GET /visits/slots?doctorId=&date=` (or `from=&to=`, ≤ 14 days) | admin, doctor | Slots with `available` flag | 200 | 400, 404 |
| `POST /visits` | admin, doctor | Schedule (future, inside working hours, no overlap) | 201 | 400, 403, 404, 409 |
| `GET /visits/:id` | staff; patient (own) | Read (patients never get `internalNotes`) | 200 | 403, 404 |
| `PATCH /visits/:id` | admin, doctor (own) | Reschedule, status, notes, diagnosis | 200 | 400, 403, 404, 409 |
| `DELETE /visits/:id` | admin | Delete visit + its files | 200 | 404 |
| `POST /visits/:id/prescriptions` | admin, doctor (own) | Multipart field `prescription` (JPEG/PNG/WebP, ≤ 5 MB) → returns `url` | 201 | 400, 403, 413, 415 |
| `GET /visits/:id/prescriptions/:file` | staff; patient (own) | Download image | 200 | 403, 404 |
| `DELETE /visits/:id/prescriptions/:file` | admin, doctor (own) | Remove image | 200 | 404 |

### Reports & audit
| Method & path | Who | Description |
|---|---|---|
| `GET /reports/appointments-by-doctor-month?year=&doctor=` | admin, doctor (own only) | Aggregation: counts per doctor per month (total/scheduled/completed/cancelled) |
| `GET /reports/summary` | admin, doctor | Dashboard totals |
| `GET /audit-logs?user=&entity=&action=&from=&to=&page=` | admin | Who did what, when |
| `GET /health` | public | Liveness check |

---

## 5. Tests and quality

```bash
cd backend
npm test        # Jest + Supertest, with coverage; fails below 80 % statements/lines/functions
npm run lint
```
* By default tests start an **in-memory MongoDB** (downloaded once by `mongodb-memory-server`).
* To use your own MongoDB: `MONGO_URI_TEST=mongodb://127.0.0.1:27017/clinic_test npm test`.
* Everything in Docker: `docker compose -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from test`.

---

## 6. Deployment (Render + GitHub Actions)

1. **Database:** create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas), add a database user, allow network access (`0.0.0.0/0` for Render free tier), copy the connection string.
2. **Render:** *New → Blueprint* → select this GitHub repo (it reads `render.yaml`). Set `MONGO_URI` (Atlas string) and `CORS_ORIGIN` (your `https://<name>.onrender.com` URL). `JWT_*` secrets are generated automatically.
3. **Deploy hook:** Render service → *Settings → Deploy Hook* → copy the URL.
4. **GitHub secrets** (*Settings → Secrets and variables → Actions*): `RENDER_DEPLOY_HOOK_URL` (required) and `APP_URL` (optional, enables the post-deploy health check).
5. Push to `main`. The pipeline (`.github/workflows/ci.yml`) runs **lint → tests → Docker build → deploy**. Pull requests run everything except deploy.
6. Create the first admin: run `node scripts/seed.js` once from a Render shell **or** insert an admin yourself, then **change the demo password**. ⚠️ The seed script wipes data — never run it against a database with real patients.

Notes: Render's free tier sleeps after inactivity and has an **ephemeral disk** — uploaded prescriptions are lost on redeploy. See [`docs/HANDOVER.md`](docs/HANDOVER.md) for moving uploads to cloud storage.

---

## 7. Project structure

```
backend/
  src/ config/ models/ validators/ middleware/ controllers/ routes/ utils/  app.js server.js
  tests/            Jest + Supertest tests
  scripts/seed.js   demo data
frontend/src/       pages/ components/ api.js AuthContext.jsx
docs/               ARCHITECTURE.md  HANDOVER.md  API.md  SIMPLE_EXPLANATION_UR.md  SUBMISSION_NOTES.md
Dockerfile  docker-compose*.yml  render.yaml  .github/workflows/ci.yml
```

## 8. Where each task lives

| Task | Code |
|---|---|
| 1 Data model & API | `backend/src/models`, `controllers/{patient,doctor,visit}`, `routes`, `tests/{patients,doctors}.test.js` |
| 2 JWT & roles | `middleware/auth.js`, `controllers/auth.controller.js`, `models/User.js`, `tests/auth.test.js` |
| 3 Calendar, notes, uploads | `frontend/src/pages/CalendarPage.jsx`, `VisitDetail.jsx`, `middleware/upload.js`, `visit.controller.js`, `tests/visits.test.js` |
| 4 Audit, reports, privacy | `models/Audit.js`, `models/auditPlugin.js`, `report.controller.js`, `patient.controller.js#history`, `tests/audit-reports.test.js` |
| 5 CI/CD & handover | `Dockerfile`, `.github/workflows/ci.yml`, `render.yaml`, `docs/` |

## 9. Security highlights
bcrypt-hashed passwords · short-lived access tokens + rotating refresh tokens (stored hashed) · role middleware on every route · Zod validation with unknown fields rejected · Helmet, CORS allow-list, rate-limited login · uploads: type + size + magic-byte check, random file names, private (token-protected) downloads · audit log is append-only and stores field *names*, never patient data · patients cannot read other patients' data or clinician-only notes.
