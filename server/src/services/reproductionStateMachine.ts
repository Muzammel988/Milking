import type {
  Prisma,
  Animal,
  SystemParameters,
  BreedingEventType,
  BreedingEventResult,
} from "@prisma/client";
import { ensurePendingAlert, resolveAlertsOfType } from "./alertService.js";
import { startLactationCycle, closeLactationCycle } from "./lactationService.js";

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

export class InvalidTransitionError extends Error {}

/**
 * Interpretation note: the spec lists Fresh and Voluntary Wait as distinct
 * states but only defines a single "voluntary wait" day-count. This
 * implementation treats Fresh as the immediate post-calving window up to
 * SystemParameters.postpartumCheckDay, then Voluntary Wait as the remainder
 * of the window up to voluntaryWaitDays, at which point the animal opens.
 * Both are purely time-driven (see evaluateReproductionTimers) — no
 * BreedingEvent is required to move between them.
 */

export interface BreedingEventInput {
  animalId: string;
  type: BreedingEventType;
  eventDate: Date;
  result?: BreedingEventResult | null;
  operatorId?: string | null;
}

/** Applies the side effects of a newly-recorded BreedingEvent to the animal's reproduction state. */
export async function applyBreedingEvent(
  tx: Tx,
  animal: Animal,
  params: SystemParameters,
  input: BreedingEventInput
): Promise<void> {
  if (animal.breedingState === "CULLED") {
    throw new InvalidTransitionError(`Animal ${animal.id} is culled and cannot record breeding events`);
  }

  switch (input.type) {
    case "HEAT_OBSERVED":
    case "SYNCHRONIZATION_STEP":
      return onHeatSignal(tx, animal, params, input);
    case "INSEMINATION":
      return onInsemination(tx, animal, params, input);
    case "PREGNANCY_CHECK":
      return onPregnancyCheck(tx, animal, params, input);
    case "CALVING":
      return onCalving(tx, animal, params, input);
    case "DRY_OFF":
      return onDryOff(tx, animal, input);
    case "ABORTION":
      return onAbortion(tx, animal, input);
  }
}

async function onHeatSignal(tx: Tx, animal: Animal, params: SystemParameters, input: BreedingEventInput) {
  const allowed: Animal["breedingState"][] = ["FRESH", "VOLUNTARY_WAIT", "OPEN", "IN_HEAT"];
  if (!allowed.includes(animal.breedingState)) {
    throw new InvalidTransitionError(
      `Cannot record heat/synchronization for animal in state ${animal.breedingState}`
    );
  }

  const heatWindowExpiresAt = new Date(input.eventDate.getTime() + params.heatWindowHours * HOUR_MS);

  await tx.animal.update({
    where: { id: animal.id },
    data: {
      breedingState: "IN_HEAT",
      breedingStateSince: input.eventDate,
      heatWindowExpiresAt,
    },
  });

  await resolveAlertsOfType(tx, animal.id, ["READY_TO_BREED", "OPEN_TOO_LONG"], "DONE");
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "IN_HEAT",
    urgency: "URGENT",
    dueDate: heatWindowExpiresAt,
    message: `Fertile window open until ${heatWindowExpiresAt.toISOString()} — breed now`,
  });
}

async function onInsemination(tx: Tx, animal: Animal, params: SystemParameters, input: BreedingEventInput) {
  const allowed: Animal["breedingState"][] = ["OPEN", "IN_HEAT", "INSEMINATED"];
  if (!allowed.includes(animal.breedingState)) {
    throw new InvalidTransitionError(`Cannot record insemination for animal in state ${animal.breedingState}`);
  }

  const pregnancyCheckDue = addDays(input.eventDate, params.pregnancyCheckDays);

  await tx.animal.update({
    where: { id: animal.id },
    data: {
      breedingState: "INSEMINATED",
      breedingStateSince: input.eventDate,
      lastInseminationDate: input.eventDate,
      heatWindowExpiresAt: null,
    },
  });

  await resolveAlertsOfType(tx, animal.id, ["IN_HEAT", "READY_TO_BREED", "OPEN_TOO_LONG"], "DONE");
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "PREGNANCY_CHECK_DUE",
    urgency: "NORMAL",
    dueDate: pregnancyCheckDue,
    message: `Pregnancy check due (${params.pregnancyCheckDays} days post-insemination)`,
  });
}

async function onPregnancyCheck(tx: Tx, animal: Animal, params: SystemParameters, input: BreedingEventInput) {
  const allowed: Animal["breedingState"][] = ["INSEMINATED", "PREGNANT"];
  if (!allowed.includes(animal.breedingState)) {
    throw new InvalidTransitionError(`Cannot record pregnancy check for animal in state ${animal.breedingState}`);
  }

  await resolveAlertsOfType(tx, animal.id, ["PREGNANCY_CHECK_DUE", "PREGNANCY_CHECK_OVERDUE"], "DONE");

  if (input.result === "POSITIVE") {
    const inseminationDate = animal.lastInseminationDate ?? input.eventDate;
    const expectedCalvingDate = addDays(inseminationDate, params.gestationLengthDays);
    const dryOffDue = addDays(expectedCalvingDate, -params.dryOffOffsetDays);
    const closeToCalvingDue = addDays(expectedCalvingDate, -params.closeToCalvingOffsetDays);

    await tx.animal.update({
      where: { id: animal.id },
      data: { breedingState: "PREGNANT", breedingStateSince: input.eventDate, expectedCalvingDate },
    });

    await ensurePendingAlert(tx, {
      animalId: animal.id,
      type: "DRY_OFF_DUE",
      urgency: "NORMAL",
      dueDate: dryOffDue,
      message: `Dry-off due (${params.dryOffOffsetDays} days before expected calving on ${expectedCalvingDate.toDateString()})`,
    });
    await ensurePendingAlert(tx, {
      animalId: animal.id,
      type: "CLOSE_TO_CALVING",
      urgency: "NORMAL",
      dueDate: closeToCalvingDue,
      message: `Close to calving (expected ${expectedCalvingDate.toDateString()})`,
    });
    return;
  }

  if (input.result === "NEGATIVE") {
    await tx.animal.update({
      where: { id: animal.id },
      data: { breedingState: "OPEN", breedingStateSince: input.eventDate, lastInseminationDate: null },
    });
    await ensurePendingAlert(tx, {
      animalId: animal.id,
      type: "READY_TO_BREED",
      urgency: "NORMAL",
      dueDate: input.eventDate,
      message: "Pregnancy check negative — ready to breed again",
    });
    return;
  }

  // INCONCLUSIVE: stay INSEMINATED, schedule a confirmatory check.
  const inseminationDate = animal.lastInseminationDate ?? input.eventDate;
  const confirmDue = addDays(inseminationDate, params.confirmatoryCheckDays);
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "PREGNANCY_CHECK_DUE",
    urgency: "NORMAL",
    dueDate: confirmDue,
    message: `Confirmatory pregnancy check due (${params.confirmatoryCheckDays} days post-insemination)`,
  });
}

async function onCalving(tx: Tx, animal: Animal, params: SystemParameters, input: BreedingEventInput) {
  if (animal.breedingState === "CULLED") {
    throw new InvalidTransitionError(`Cannot record calving for culled animal ${animal.id}`);
  }

  const postpartumCheckDue = addDays(input.eventDate, params.postpartumCheckDay);

  await tx.animal.update({
    where: { id: animal.id },
    data: {
      status: animal.status === "HEIFER" ? "COW" : animal.status,
      breedingState: "FRESH",
      breedingStateSince: input.eventDate,
      lastCalvingDate: input.eventDate,
      lastInseminationDate: null,
      expectedCalvingDate: null,
      heatWindowExpiresAt: null,
      lactationNumber: { increment: 1 },
      currentLactationStart: input.eventDate,
      lactationState: "FRESH",
    },
  });
  await startLactationCycle(tx, animal, params, input.eventDate);

  await resolveAlertsOfType(
    tx,
    animal.id,
    ["DRY_OFF_DUE", "CLOSE_TO_CALVING", "PREGNANCY_CHECK_DUE", "PREGNANCY_CHECK_OVERDUE", "IN_HEAT", "OPEN_TOO_LONG"],
    "DONE"
  );
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "POSTPARTUM_CHECK",
    urgency: "LOW",
    dueDate: postpartumCheckDue,
    message: `Optional postpartum check (day ${params.postpartumCheckDay})`,
  });
}

async function onDryOff(tx: Tx, animal: Animal, input: BreedingEventInput) {
  const allowed: Animal["breedingState"][] = ["PREGNANT", "CLOSE_TO_CALVING"];
  if (!allowed.includes(animal.breedingState)) {
    throw new InvalidTransitionError(`Cannot record dry-off for animal in state ${animal.breedingState}`);
  }

  await tx.animal.update({
    where: { id: animal.id },
    data: { breedingState: "DRY", breedingStateSince: input.eventDate, status: "DRY", lactationState: "DRY" },
  });
  await closeLactationCycle(tx, animal, input.eventDate);
  await resolveAlertsOfType(tx, animal.id, ["DRY_OFF_DUE"], "DONE");
}

async function onAbortion(tx: Tx, animal: Animal, input: BreedingEventInput) {
  const allowed: Animal["breedingState"][] = ["INSEMINATED", "PREGNANT", "CLOSE_TO_CALVING"];
  if (!allowed.includes(animal.breedingState)) {
    throw new InvalidTransitionError(`Cannot record abortion for animal in state ${animal.breedingState}`);
  }

  await tx.animal.update({
    where: { id: animal.id },
    data: {
      breedingState: "OPEN",
      breedingStateSince: input.eventDate,
      lastInseminationDate: null,
      expectedCalvingDate: null,
    },
  });
  await resolveAlertsOfType(
    tx,
    animal.id,
    ["DRY_OFF_DUE", "CLOSE_TO_CALVING", "PREGNANCY_CHECK_DUE", "PREGNANCY_CHECK_OVERDUE"],
    "DONE"
  );
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "READY_TO_BREED",
    urgency: "NORMAL",
    dueDate: input.eventDate,
    message: "Abortion recorded — ready to breed again",
  });
}

/**
 * Time-driven transitions that don't depend on a new BreedingEvent being
 * recorded. Intended to run for every non-culled animal once per night, but
 * safe to call more often (e.g. on-demand from the dashboard) since it's
 * idempotent — re-evaluating an animal already in the target state is a
 * no-op beyond refreshing alert due dates.
 */
export async function evaluateReproductionTimers(
  tx: Tx,
  animal: Animal,
  params: SystemParameters,
  now: Date = new Date()
): Promise<void> {
  if (animal.breedingState === "CULLED" || animal.breedingState === "NOT_APPLICABLE") return;

  switch (animal.breedingState) {
    case "FRESH": {
      if (!animal.lastCalvingDate) return;
      const days = daysBetween(animal.lastCalvingDate, now);
      if (days >= params.voluntaryWaitDays) {
        await openForBreeding(tx, animal, now);
      } else if (days >= params.postpartumCheckDay) {
        await tx.animal.update({
          where: { id: animal.id },
          data: { breedingState: "VOLUNTARY_WAIT", breedingStateSince: now },
        });
      }
      return;
    }

    case "VOLUNTARY_WAIT": {
      if (!animal.lastCalvingDate) return;
      const days = daysBetween(animal.lastCalvingDate, now);
      if (days >= params.voluntaryWaitDays) {
        await openForBreeding(tx, animal, now);
      }
      return;
    }

    case "OPEN": {
      if (!animal.lastCalvingDate) return;
      const days = daysBetween(animal.lastCalvingDate, now);
      if (days >= params.openTooLongDays) {
        await ensurePendingAlert(tx, {
          animalId: animal.id,
          type: "OPEN_TOO_LONG",
          urgency: "HIGH",
          dueDate: now,
          message: `Open for ${Math.floor(days)} days since calving — exceeds ${params.openTooLongDays} day target`,
        });
      }
      return;
    }

    case "IN_HEAT": {
      if (animal.heatWindowExpiresAt && now > animal.heatWindowExpiresAt) {
        await tx.animal.update({
          where: { id: animal.id },
          data: { breedingState: "OPEN", breedingStateSince: now, heatWindowExpiresAt: null },
        });
        await tx.alert.updateMany({
          where: { animalId: animal.id, type: "IN_HEAT", status: "PENDING" },
          data: { status: "DISMISSED", resolvedAt: now, message: "Missed — heat window expired without insemination" },
        });
      }
      return;
    }

    case "INSEMINATED": {
      const overdue = await tx.alert.findFirst({
        where: { animalId: animal.id, type: "PREGNANCY_CHECK_DUE", status: "PENDING", dueDate: { lt: now } },
      });
      if (overdue) {
        await tx.alert.update({
          where: { id: overdue.id },
          data: { status: "DONE", resolvedAt: now },
        });
        await ensurePendingAlert(tx, {
          animalId: animal.id,
          type: "PREGNANCY_CHECK_OVERDUE",
          urgency: "HIGH",
          dueDate: overdue.dueDate,
          message: "Pregnancy check overdue",
        });
      }
      return;
    }

    case "PREGNANT": {
      if (!animal.expectedCalvingDate) return;
      const daysToCalving = daysBetween(now, animal.expectedCalvingDate);
      if (daysToCalving <= params.closeToCalvingOffsetDays) {
        await tx.animal.update({
          where: { id: animal.id },
          data: { breedingState: "CLOSE_TO_CALVING", breedingStateSince: now },
        });
      }
      return;
    }

    case "CLOSE_TO_CALVING":
    case "DRY":
      return;
  }
}

async function openForBreeding(tx: Tx, animal: Animal, now: Date) {
  await tx.animal.update({
    where: { id: animal.id },
    data: { breedingState: "OPEN", breedingStateSince: now },
  });
  await ensurePendingAlert(tx, {
    animalId: animal.id,
    type: "READY_TO_BREED",
    urgency: "NORMAL",
    dueDate: now,
    message: "Voluntary wait period elapsed — ready to breed",
  });
}
