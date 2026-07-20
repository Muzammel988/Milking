import type { Prisma, Animal, SystemParameters } from "@prisma/client";
import { ensurePendingAlert, resolveAlertsOfType } from "./alertService.js";

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

/** Starts a new lactation cycle for a just-calved animal — called from the reproduction state machine's CALVING handler. */
export async function startLactationCycle(
  tx: Tx,
  animal: Animal,
  params: SystemParameters,
  startDate: Date
): Promise<void> {
  const cycleNumber = animal.lactationNumber + 1; // animal.lactationNumber is incremented by the same CALVING handler
  await tx.lactationCycle.create({
    data: {
      animalId: animal.id,
      cycleNumber,
      startDate,
      colostrumEndDate: addDays(startDate, params.colostrumDays),
      state: "FRESH",
    },
  });
  await resolveAlertsOfType(tx, animal.id, ["YIELD_DROP", "MISSING_MILK_DATA"], "DONE");
}

/** Closes the active lactation cycle — called from the reproduction state machine's DRY_OFF handler. */
export async function closeLactationCycle(tx: Tx, animal: Animal, endDate: Date): Promise<void> {
  const cycle = await tx.lactationCycle.findFirst({
    where: { animalId: animal.id, endDate: null },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) return;

  const records = await tx.milkRecord.findMany({
    where: { animalId: animal.id, recordDate: { gte: cycle.startDate, lte: endDate } },
  });

  const byDay = new Map<string, number>();
  for (const r of records) {
    const key = r.recordDate.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + r.yieldLiters);
  }
  const dailyTotals = [...byDay.values()];
  const totalYield = dailyTotals.reduce((a, b) => a + b, 0);
  const peakYield = dailyTotals.length ? Math.max(...dailyTotals) : null;
  const avgDailyYield = dailyTotals.length ? totalYield / dailyTotals.length : null;

  await tx.lactationCycle.update({
    where: { id: cycle.id },
    data: { endDate, state: "DRY", totalYield, peakYield, avgDailyYield },
  });

  await resolveAlertsOfType(tx, animal.id, ["YIELD_DROP", "MISSING_MILK_DATA"], "DONE");
}

function stateForDim(dim: number, params: SystemParameters): "FRESH" | "PEAK" | "MID_LACTATION" | "LATE_LACTATION" {
  if (dim < params.freshLactationDays) return "FRESH";
  if (dim < params.peakLactationDays) return "PEAK";
  if (dim < params.midLactationDays) return "MID_LACTATION";
  return "LATE_LACTATION";
}

/**
 * Time-driven lactation evaluation: advances the cycle's DIM-based state,
 * flags a yield-drop health-check suggestion during Peak, flags missing
 * milking data, and raises a DIM-based dry-off recommendation as a fallback
 * to the pregnancy-based one from the reproduction state machine. Intended
 * to run nightly for every animal with an open lactation cycle.
 */
export async function evaluateLactationTimers(
  tx: Tx,
  animal: Animal,
  params: SystemParameters,
  now: Date = new Date()
): Promise<void> {
  const cycle = await tx.lactationCycle.findFirst({
    where: { animalId: animal.id, endDate: null },
    orderBy: { startDate: "desc" },
  });
  if (!cycle) return;

  const dim = daysBetween(cycle.startDate, now);
  const nextState = stateForDim(dim, params);
  if (nextState !== cycle.state) {
    await tx.lactationCycle.update({ where: { id: cycle.id }, data: { state: nextState } });
    await tx.animal.update({ where: { id: animal.id }, data: { lactationState: nextState } });
  }

  // Yield-drop anomaly: only meaningful once past the colostrum/Fresh ramp-up, during Peak (per spec).
  if (nextState === "PEAK") {
    const recent = await tx.milkRecord.findMany({
      where: { animalId: animal.id, recordDate: { gte: addDays(now, -4) } },
      orderBy: { recordDate: "desc" },
    });
    const byDay = new Map<string, number>();
    for (const r of recent) {
      const key = r.recordDate.toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) ?? 0) + r.yieldLiters);
    }
    const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
    if (days.length >= 2) {
      const [, latestYield] = days[0];
      const priorDays = days.slice(1, 4).map(([, v]) => v);
      const priorAvg = priorDays.reduce((a, b) => a + b, 0) / priorDays.length;
      if (priorAvg > 0) {
        const dropPct = ((priorAvg - latestYield) / priorAvg) * 100;
        if (dropPct >= params.yieldDropThresholdPct) {
          await ensurePendingAlert(tx, {
            animalId: animal.id,
            type: "YIELD_DROP",
            urgency: "HIGH",
            dueDate: now,
            message: `Yield dropped ${dropPct.toFixed(0)}% vs 3-day average (${latestYield.toFixed(1)}L vs ${priorAvg.toFixed(1)}L) — recommend a health check`,
          });
        }
      }
    }
  }

  // Missing milking data, regardless of lactation state, once past colostrum.
  if (now > cycle.colostrumEndDate) {
    const lastRecord = await tx.milkRecord.findFirst({
      where: { animalId: animal.id },
      orderBy: { recordDate: "desc" },
    });
    const daysSinceLast = lastRecord ? daysBetween(lastRecord.recordDate, now) : daysBetween(cycle.startDate, now);
    if (daysSinceLast >= params.missingMilkDataDays) {
      await ensurePendingAlert(tx, {
        animalId: animal.id,
        type: "MISSING_MILK_DATA",
        urgency: "NORMAL",
        dueDate: now,
        message: `No milk record in ${Math.floor(daysSinceLast)} days`,
      });
    }
  }

  // DIM-based dry-off recommendation, as a fallback to the pregnancy-based one.
  if (dim >= params.targetDryOffDim) {
    await ensurePendingAlert(tx, {
      animalId: animal.id,
      type: "DRY_OFF_DUE",
      urgency: "NORMAL",
      dueDate: now,
      message: `${Math.floor(dim)} days in milk — at or past the ${params.targetDryOffDim}-day dry-off target`,
    });
  }
}
