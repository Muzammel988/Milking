# Milking

A dairy-herd management app built around a single source of truth per animal
instead of siloed report screens. This is Phase 1 of the product vision:
the **Animal** entity, the **reproduction state machine**, generated
**Alerts**, the **Animal Profile** timeline, and the **Herd Dashboard**.

## Structure

- `server/` — Express + TypeScript API on PostgreSQL (Prisma). Owns the
  Animal/BreedingEvent/Alert data model and the reproduction state-machine
  logic (`src/services/reproductionStateMachine.ts`) plus the nightly
  timer-evaluation job (`src/jobs/reproductionJob.ts`).
- `web/` — React + Vite + TypeScript dashboard. Herd Dashboard, Animal List,
  and Animal Profile (timeline + quick-add breeding events).

## Running locally

Requires PostgreSQL running locally (or update `DATABASE_URL`).

```bash
# 1. API
cd server
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npm run prisma:migrate
npm run seed            # optional demo data
npm run dev              # http://localhost:4000

# 2. Web app (separate terminal)
cd web
npm install
npm run dev              # http://localhost:5173
```

Run the nightly reproduction-state-machine evaluation on demand with
`npm run job:reproduction` (server/) or via `POST /api/jobs/reproduction`
(also exposed as a "Run nightly evaluation now" button on the dashboard).

## Tests

```bash
cd server
npm test
```

Tests run against a separate `milking_test` database (`.env.test`).

## What's implemented (Phase 1)

- Animal, BreedingEvent, CalvingDetail, Alert, Farm, Location, User,
  SystemParameters tables (Prisma schema in `server/prisma/schema.prisma`).
- Reproduction state machine: Fresh → Voluntary Wait → Open → In Heat →
  Inseminated → Pregnant → Close to Calving → Dry, plus terminal Culled,
  driven by BreedingEvent creation and a nightly timer job, generating
  Alerts (ready-to-breed, open-too-long, in-heat, pregnancy-check
  due/overdue, dry-off due, close-to-calving, postpartum check) instead of
  hand-maintained TODO widgets.
- Animal Profile: unified chronological timeline + quick-add breeding event.
- Herd Dashboard: today's alerts grouped by urgency + herd counts by
  breeding state.

## Not yet built (later phases per the product spec)

Milk records + lactation state machine, health events + withdrawal-period
tracking, feed/ration costing, financial transactions and per-animal P&L,
offline-capable Quick Entry screen, and role-based permissions enforcement.
