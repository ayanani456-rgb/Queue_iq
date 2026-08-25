# QueueIQ

A WhatsApp-first appointment & queue-management platform for clinics and service
businesses. Patients book a numbered **token** for a specific doctor, watch their
turn live, and get an **AI-estimated wait**; staff manage each doctor's line from a
dashboard, with a human-approved lane for emergencies.

This repository holds the **backend** and the **AI microservice**. The database is
hosted on **Supabase** (Postgres). The customer/staff frontend is a separate app;
a working demo/test page is bundled inside the backend for now.

---

## Repository structure

```
Queue_iq/
├── backend/                     Node.js + Express API (the queue brain)
│   ├── src/
│   │   ├── app.js               entry point — routes, serves the demo page, starts the AI
│   │   ├── startAi.js           auto-launches the AI microservice with the server
│   │   ├── routes/              URL → controller wiring
│   │   │   ├── booking.routes.js      /api/tokens/*
│   │   │   └── business.routes.js     /api/business/*
│   │   ├── controllers/         request handlers (the actual logic)
│   │   │   ├── booking.controller.js  book, status, my-tokens
│   │   │   └── business.controller.js queue view, call-next, complete, approve-emergency
│   │   ├── logic/
│   │   │   └── queueLogic.js     queue rules (positions, 3:1 express, emergency insert)
│   │   ├── data/                the "data layer" (swappable)
│   │   │   ├── store.js          selector: Supabase if a key is set, else in-memory
│   │   │   ├── queueStore.supabase.js   Postgres-backed store
│   │   │   └── queueStore.js     in-memory store (fallback / offline dev)
│   │   └── public/
│   │       └── test.html        the bundled demo page (served at /test)
│   ├── db/
│   │   └── schema.sql            reference schema notes
│   ├── package.json
│   └── .env.example             copy to .env and fill in (see below)
│
└── ai-microservice/             Python FastAPI service (advisory only)
    ├── main.py                  /api/ai/predict-wait  +  /api/ai/verify-emergency
    └── requirements.txt
```

---

## The pieces (how it's put together)

| Piece | Tech | Job |
|---|---|---|
| **Backend** | Node.js / Express | Runs the queue: booking, positions, per-doctor lines, staff actions. Reads/writes the database with a privileged key. |
| **AI microservice** | Python / FastAPI | **Advisory only.** Predicts wait time (with a confidence range) and triages emergencies (urgency score, English + roman-Urdu). Never approves anything — a human does. |
| **Database** | Supabase (Postgres) | Stores everything: organizations, departments, doctors, tokens, patients, accounts, feedback. |
| **Frontend** | (separate app) | The customer/staff UI. A demo `test.html` is bundled for now. |

### Key idea: queues are **per-doctor**

Every token belongs to a specific **doctor** (`tokens.doctor_id`). Each doctor has
their **own line**, so a patient for Doctor A never waits behind Doctor B. A
**receptionist** account is scoped to a **department** and manages each of that
department's doctors' lines separately.

---

## How data flows (two paths)

The frontend talks to **two** places:

**A · Straight to the database** — reads about *who exists* (uses the public key,
limited by Row Level Security):
- **Login** → Supabase `login()` function → checks `accounts`, returns the role
- **Catalog** → `organizations`, `departments`, `doctors` tables

**B · Through the backend** — anything that touches the *queue* (runs the logic,
writes to locked tables with the service-role key, and calls the AI when needed):

| Method | Route | What it does |
|---|---|---|
| `POST` | `/api/tokens/book` | Book a token in a doctor's line; asks the AI for a wait. Emergencies are held for approval. |
| `GET`  | `/api/tokens/status/:token` | Live status of one token (position, wait, now serving). |
| `GET`  | `/api/tokens/mine?clientId=…` | Every token a client booked, each with live status. |
| `GET`  | `/api/business/tokens?doctorId=…` | One doctor's queue + summary. |
| `POST` | `/api/business/call-next` | Serve the next patient in a doctor's line. |
| `POST` | `/api/business/complete` | Mark a visit done. |
| `POST` | `/api/business/approve-emergency` | Human approves/rejects an emergency; a rejection counts as a false claim. |

> Rule of thumb: **read who-exists → database directly; do anything with the queue → backend.**

---

## Database tables (Supabase)

| Table | Holds |
|---|---|
| `organizations` | clinics/banks/salons/etc. — name, type, address, hours |
| `departments` | a clinic's departments (Cardiology, …) |
| `doctors` | doctors, linked to a department + organization |
| `tokens` | the queue — one row per booked token (doctor_id, client_id, position, status, …) |
| `patients` | emergency abuse tracking (false-claim count, suspension) |
| `accounts` | demo logins (patient / receptionist / doctor) — **demo-grade; replace with Supabase Auth for production** |
| `feedbacks` | ratings & reviews |

---

## Getting started

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values (see below)
node src/app.js
```
The server starts on **http://localhost:5000** and serves the demo page at
**http://localhost:5000/test**. It also tries to auto-start the AI service.

### 2. AI microservice (optional but recommended)

Needs Python 3. The backend auto-starts it, but install its deps once:

```bash
cd ai-microservice
pip install -r requirements.txt
```
Without it, the backend still runs — wait estimates just fall back to simple local
math (`estimateSource: "local-fallback"` instead of `"ai"`).

### 3. Environment variables (`backend/.env`)

```
PORT=5000
AI_SERVICE_URL=http://localhost:8000
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_KEY=<your Supabase SERVICE ROLE key>   # secret — never commit
QUEUEIQ_ORG_ID=<the organization id this backend serves>
AI_PYTHON=<absolute path to python.exe>          # optional, for reliable AI auto-start on Windows
```

> The `.env` is **git-ignored** on purpose — it holds a secret. Each machine/host
> gets its own. Use the Supabase **service_role** key here (the server bypasses
> Row Level Security); the frontend uses the public key.

---

## The demo page

Open `http://localhost:5000/test`. Login accounts (all password `123456`):

| Email | Role | Sees |
|---|---|---|
| `patient@demo.com` | patient (Bilal) | booking flow + "My tokens" |
| `patient2@demo.com` | patient (Sara) | a different set of tokens |
| `reception.cardio@alshifa.com` | receptionist | picks a Cardiology doctor, manages that line |
| `dr.ayesha@alshifa.com` | doctor | only their own queue |

Login and catalog come **live from Supabase**; booking and the queue go through the
backend. (The demo page is a dev harness — the real frontend is a separate app.)

---

## Notes for going to production

- **Auth:** the `accounts` table + `login()` function are demo-grade (plain
  passwords). Replace with **Supabase Auth** (hashed passwords, real sessions) +
  a `profiles` table for roles.
- **Hosting:** frontend → Vercel; backend → Vercel serverless or an always-on host
  (Render/Railway); AI service → its own Python host (it can't be a child process
  on serverless). Set secrets as host **environment variables**, not files.
- **Multi-clinic:** the backend currently serves one organization
  (`QUEUEIQ_ORG_ID`); take the organization per request to serve many.

---

*Backend + AI microservice for QueueIQ. Database on Supabase. Frontend is a
separate application.*
