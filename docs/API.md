# API examples

All examples use `curl`. Replace `$T` with an access token.

## Login
```bash
curl -X POST http://localhost:5000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@brewbean.test","password":"Password123"}'
```
```json
{ "success": true, "data": { "user": { "_id": "…", "role": "admin" }, "accessToken": "eyJ…", "refreshToken": "eyJ…" } }
```
The access token contains `exp` (15 minutes by default). When it expires call `POST /api/auth/refresh` with `{ "refreshToken": "…" }`; you get a new pair and the old refresh token stops working.

## Create a patient (doctor/admin)
```bash
curl -X POST http://localhost:5000/api/patients -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"firstName":"Sara","lastName":"Ali","email":"sara@example.com","phone":"0311 1234567","dateOfBirth":"1996-04-12","gender":"female"}'
```
`201` with the patient incl. computed `fullName` and `age`. `400` lists the invalid fields, `409` means the email already exists.

## Free slots, then book one
```bash
curl "http://localhost:5000/api/visits/slots?doctorId=<id>&date=2026-10-12" -H "Authorization: Bearer $T"
curl -X POST http://localhost:5000/api/visits -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"patient":"<patientId>","doctor":"<doctorId>","scheduledAt":"2026-10-12T05:00:00.000Z","durationMinutes":30,"reason":"Check-up"}'
```
Rules: future time · inside the doctor's working days/hours · no overlap with another non-cancelled visit (`409`).

## Upload a prescription
```bash
curl -X POST http://localhost:5000/api/visits/<visitId>/prescriptions -H "Authorization: Bearer $T" -F "prescription=@rx.png"
```
Returns the visit; each prescription has a `url` like `/api/visits/<id>/prescriptions/<random>.png` (download needs a token).
`415` wrong type / fake image, `413` too large.

## Patient history (privacy-aware)
```bash
curl http://localhost:5000/api/patients/<patientId>/history -H "Authorization: Bearer $T"
```
Doctor/admin → `"view":"full"` including `internalNotes`. Patient (own id) → `"view":"patient"`, no `internalNotes`. Another patient's id → `403`.

## Report
```bash
curl "http://localhost:5000/api/reports/appointments-by-doctor-month?year=2026" -H "Authorization: Bearer $T"
```
```json
{ "data": { "year": 2026, "rows": [ { "doctorName": "Dr. Ayesha Khan", "month": "2026-10", "total": 12, "scheduled": 4, "completed": 7, "cancelled": 1 } ] } }
```

## Audit log (admin)
```bash
curl "http://localhost:5000/api/audit-logs?entity=Patient&action=UPDATE&limit=20" -H "Authorization: Bearer $T"
```
Entry: `{ action, entity, entityId, user, userRole, changedFields:[…], ip, method, path, timestamp }`.
