# Milking

A dairy-herd management app built around a single source of truth per animal
instead of siloed report screens. Every module (breeding, milk, health, feed,
finance) reads and writes to one animal timeline, and the reproduction and
lactation cycles are modeled as explicit state machines that generate the
next required action automatically.

## Structure

- `server/` — Express + TypeScript API on PostgreSQL (Prisma). Owns the full
  data model and both state machines:
  - `src/services/reproductionStateMachine.ts` + `src/jobs/reproductionJob.ts`
  - `src/services/lactationService.ts` + `src/jobs/lactationJob.ts`
  - `src/middleware/permissions.ts` — role-based write permissions
- `web/` — React + Vite + TypeScript app: Herd Dashboard, Animal List,
  Animal Profile (merged timeline), Quick Entry (offline-capable), Reports,
  and Settings/Admin.

## Running locally

Requires PostgreSQL running locally (or update `DATABASE_URL`).

```bash
# 1. API
cd server
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npm run prisma:migrate
npm run seed            # demo data: 4 animals, 5 users (one per role), catalogs
npm run dev              # http://localhost:4000

# 2. Web app (separate terminal)
cd web
npm install
npm run dev              # http://localhost:5173
```

Run the nightly state-machine evaluations on demand with `npm run
job:reproduction` / `npm run job:lactation` (server/), or `POST
/api/jobs/run-all` (also exposed as a "Run nightly evaluation now" button on
the dashboard).

There's no login system yet — the header's user-switcher lets you act as any
seeded user (one per role) so you can see role-based permission enforcement
in action (e.g. a Milker can save milk records but gets a 403 adding an
animal or editing financials).

## Tests

```bash
cd server
npm test
```

23 vitest cases (reproduction + lactation state machines) run against a
separate `milking_test` database (`.env.test`).

## What's implemented

**Data model** (`server/prisma/schema.prisma`): Farm, User, Location,
SystemParameters, Animal, BreedingEvent, CalvingDetail, Alert, MilkRecord,
LactationCycle, HealthEvent, Medicine, Vaccine, FeedIngredient,
RationFormula, FeedConsumptionRecord, FinancialTransaction, SemenStraw.

**Reproduction state machine**: Fresh → Voluntary Wait → Open → In Heat →
Inseminated → Pregnant → Close to Calving → Dry, plus terminal Culled,
driven by BreedingEvent creation and a nightly timer job. Generates Alerts
(ready-to-breed, open-too-long, in-heat, pregnancy-check due/overdue,
dry-off due, close-to-calving, postpartum check) instead of hand-maintained
TODO widgets.

**Lactation state machine**: Fresh → Peak → Mid-Lactation → Late-Lactation →
Dry, tracked per `LactationCycle` (one row per calving-to-dry-off span, with
closed-cycle totals: peak yield, total yield, avg daily yield). Started by a
CALVING breeding event, closed by DRY_OFF. The nightly job also flags a
yield-drop health-check suggestion (>18% single-day drop vs. 3-day average
during Peak) and missing-milking-data.

**Health & food safety**: HealthEvent with a Medicine/Vaccine catalog;
withdrawal period + end date computed at entry time and surfaced as a banner
on the Animal Profile so milk/meat withdrawal is never silently missed.

**Feed & financials**: FeedIngredient stock depleted by FeedConsumptionRecord
(with a low-stock Alert), RationFormula cost-per-head-per-day, and
FinancialTransaction linked to an animal or group so Reports can compute
real per-animal profit & loss (milk-sale income minus feed/vet/insemination
costs) instead of a farm-wide ledger total.

**Role-based permissions**: derived from role, not stored ad hoc — a
herdsman logs breeding/milk but not financials, a milker only logs milk, a
vet logs health and reads (but doesn't edit) breeding history. Enforced
server-side (`middleware/permissions.ts`); there's no real auth yet, so the
frontend's user-switcher sends the chosen user as `x-user-id`.

**Screens**: Animal Profile (unified timeline: breeding + milk + health +
financial, with quick-add for each), Herd Dashboard (alerts by urgency +
herd counts), Quick Entry (mobile-first, offline queue with auto-sync on
reconnect, basic service-worker app-shell caching), Reports (herd status,
exit reasons, lactation curve, breeding history, profitability — filterable),
Settings/Admin (users, locations, semen inventory, medicine/vaccine
catalogs, system parameters that feed the state machines directly).

## Known simplifications

- No real authentication — the user-switcher stands in for login.
- Quick Entry covers the highest-frequency events (milk, heat/insemination/
  pregnancy-check, examination/diagnosis); calving, dry-off, abortion, and
  treatments/vaccinations (which need catalog lookups) go through the
  Animal Profile instead, since they need more structured input than a fast
  barn-side form should ask for.
- The Fresh vs. Voluntary Wait reproduction states: the spec lists them
  separately but only gives one day-count, so Fresh covers immediate
  post-calving up to the postpartum-check day, then Voluntary Wait covers
  the remainder up to the voluntary-wait threshold (see
  `reproductionStateMachine.ts` header comment).
