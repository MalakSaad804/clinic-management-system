# Project asaan zubaan mein (10th class level) — Roman Urdu

## Project hai kya?
**Brew & Bean Cafe** ke andar ek chota sa clinic hai. Wahan roz mareez (patients) aate hain, doctors unhein dekhte hain.
Abhi shayad sab kuch copy/register mein likha jata hoga. Hamein ek **website + server** banana hai jo ye sab kaam
computer par kare — aur mareezon ka data **mehfooz (secure)** rakhe.

Socho ye ek **digital register** hai jis ke sath ek **chowkidaar**, ek **calendar** aur ek **CCTV** bhi hai.

## MERN kya hota hai?
| Harf | Cheez | Aam misaal |
|---|---|---|
| M | MongoDB (database) | Almari jisme sab files rakhi hain |
| E | Express (server ka framework) | Reception ka clerk jo requests sunta hai |
| R | React (website ka front hissa) | Screen jo user ko dikhti hai |
| N | Node.js | Wo engine jis par server chalta hai |

## 5 tasks = 5 hisse
1. **Data model + API** — Hum decide karte hain data kaisa dikhega:
   *Patient* (naam, phone, DOB), *Doctor* (specialization, license), *Visit* (kaun, kis doctor se, kab, kyun).
   **Mongoose schema** = form ka format ("naam zaroori hai", "email sahi honi chahiye").
   **CRUD** = Create, Read, Update, Delete (banao, dekho, badlo, mitao).
   **Index** = kitab ki fehrist — search tez ho jati hai.
2. **Login (JWT) aur roles** — *Password* hum seedha save nahi karte, **bcrypt** se "ghotala" (hash) kar ke save karte hain,
   taake database leak ho bhi jaye to asli password na milay. Login par server ek **JWT token** deta hai —
   jaise cinema ka **ticket** jis par likha hota hai "kab tak valid hai". Har request par ye ticket dikhana parta hai.
   **Role** = kaun kya kar sakta hai: *Admin* sab, *Doctor* mareez dekhe aur visit likhe, *Patient* sirf apna data.
   Chowkidaar ke do sawal: "Aap kaun?" (authentication) aur "Aap ko ijazat hai?" (authorization).
3. **Calendar + visit notes + prescription upload** — React mein calendar jahan doctor khali **slots** dekh kar
   appointment book karta hai, drag karke time badal sakta hai. Visit ke notes likhta hai aur dawai ki parchi ki
   **photo upload** karta hai. Server check karta hai ke file sach mein image hai, bohat bari to nahi, aur naam random rakhta hai.
4. **Audit log, reports, privacy** — **Audit log** = CCTV: kisne, kab, kis record mein kya badla — sab likha jata hai
   (aur ye log mitaya nahi ja sakta). **Report** = "Har doctor ne har mahine kitne mareez dekhe" (MongoDB aggregation).
   **Privacy** = mareez sirf apni history dekhe, aur doctor ke *private notes* mareez ko na dikhein.
5. **CI/CD, deploy, handover** — **Docker** = project ko ek dibbe (container) mein pack karna taake har computer par
   same chale. **GitHub Actions** = robot jo har push par code check karta hai (lint), tests chalata hai, phir
   **Render** (hosting) par khud deploy kar deta hai. **Handover** = nayi team ke liye guide ke "ye aise chalta hai".

## Ek request ka safar (example: doctor naya patient banata hai)
Browser → (token ke sath) → **Server** → token check → role check → data ki jaanch (validation) → **MongoDB** mein save →
**audit log** mein entry → jawab wapas browser ko.

## Is zip mein kya kahan hai?
- `backend/` → server (Tasks 1, 2, 3 ka server hissa, 4)
- `frontend/` → website (Task 3 ka calendar, notes, upload; Task 4 ke pages)
- `Dockerfile`, `.github/workflows/ci.yml`, `render.yaml` → Task 5
- `docs/` → documentation, handover, aur ye file

## Chalane ke steps (sab se asaan)
```bash
cd backend && cp .env.example .env && npm install && npm run seed && npm run dev
# naya terminal
cd frontend && npm install && npm run dev
```
Browser mein `http://localhost:5173` kholo. Login: `admin@brewbean.test` / `Password123`.

## Mentor ke checklist ke sawal aur jawab
| Mentor poochega | Jawab |
|---|---|
| Schemas mein required fields aur indexes? | `backend/src/models/*.js` |
| Status codes sahi? | 201 create, 400 galat data, 401 login nahi, 403 ijazat nahi, 404 nahi mila, 409 duplicate/clash |
| Unit tests 80% se zyada? | `npm test` coverage report dikhata hai, 80% se kam par fail |
| Login JWT expiry ke sath? | `auth.controller.js` (`expiresIn`) |
| Bina token ke route band? | `middleware/auth.js` → `protect` |
| Password hashed? | `models/User.js` (bcrypt) |
| Audit mein action, user, time, document? | `models/Audit.js` + `auditPlugin.js` |
| Report doctor/mahina? | `report.controller.js` ($group aggregation) |
| Docker + GitHub Actions + deploy? | `Dockerfile`, `.github/workflows/ci.yml`, `render.yaml` |
