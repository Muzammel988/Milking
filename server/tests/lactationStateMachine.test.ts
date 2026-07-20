import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { startLactationCycle, closeLactationCycle, evaluateLactationTimers } from "../src/services/lactationService.js";
import { applyBreedingEvent } from "../src/services/reproductionStateMachine.js";
import type { Animal, SystemParameters } from "@prisma/client";

async function resetDb() {
  await prisma.alert.deleteMany();
  await prisma.milkRecord.deleteMany();
  await prisma.lactationCycle.deleteMany();
  await prisma.calvingDetail.deleteMany();
  await prisma.breedingEvent.deleteMany();
  await prisma.animal.deleteMany();
  await prisma.systemParameters.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  await prisma.farm.deleteMany();
}

async function makeFarm(paramOverrides: Partial<SystemParameters> = {}) {
  const farm = await prisma.farm.create({
    data: { name: "Test Farm", ownerName: "Tester", systemParameters: { create: paramOverrides } },
    include: { systemParameters: true },
  });
  return { farm, params: farm.systemParameters! };
}

async function makeAnimal(farmId: string, overrides: Partial<Animal> = {}): Promise<Animal> {
  return prisma.animal.create({
    data: {
      farmId,
      earTag: overrides.earTag ?? `E-${Math.random().toString(36).slice(2, 8)}`,
      breed: "Holstein",
      sex: "FEMALE",
      birthDate: new Date("2020-01-01"),
      origin: "BORN_ON_FARM",
      status: "COW",
      breedingState: "OPEN",
      lactationNumber: 0,
      ...overrides,
    },
  });
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("lactation state machine — cycle lifecycle", () => {
  it("starts a new cycle on calving and closes it with totals on dry-off", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, { breedingState: "PREGNANT", lactationNumber: 0 });

    const calvingDate = daysAgo(300);
    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, { animalId: animal.id, type: "CALVING", eventDate: calvingDate });
    });

    const cycleAfterCalving = await prisma.lactationCycle.findFirst({ where: { animalId: animal.id } });
    expect(cycleAfterCalving?.state).toBe("FRESH");
    expect(cycleAfterCalving?.cycleNumber).toBe(1);
    expect(cycleAfterCalving?.endDate).toBeNull();

    await prisma.milkRecord.createMany({
      data: [
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(10), session: "MORNING", yieldLiters: 15 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(10), session: "EVENING", yieldLiters: 12 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(5), session: "MORNING", yieldLiters: 20 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(5), session: "EVENING", yieldLiters: 18 },
      ],
    });

    // Dry-off is only valid from Pregnant/Close-to-Calving, so walk the
    // animal back through a full breeding cycle before drying her off —
    // mirroring what actually happens between two calvings.
    await prisma.$transaction(async (tx) => {
      let current = await tx.animal.findUniqueOrThrow({ where: { id: animal.id } });
      await applyBreedingEvent(tx, current, params, { animalId: animal.id, type: "HEAT_OBSERVED", eventDate: daysAgo(60) });
      current = await tx.animal.findUniqueOrThrow({ where: { id: animal.id } });
      await applyBreedingEvent(tx, current, params, { animalId: animal.id, type: "INSEMINATION", eventDate: daysAgo(60) });
      current = await tx.animal.findUniqueOrThrow({ where: { id: animal.id } });
      await applyBreedingEvent(tx, current, params, {
        animalId: animal.id,
        type: "PREGNANCY_CHECK",
        eventDate: daysAgo(30),
        result: "POSITIVE",
      });
    });

    const dryOffDate = daysAgo(1);
    const animalNow = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animalNow, params, { animalId: animal.id, type: "DRY_OFF", eventDate: dryOffDate });
    });

    const closedCycle = await prisma.lactationCycle.findFirst({ where: { animalId: animal.id } });
    expect(closedCycle?.state).toBe("DRY");
    expect(closedCycle?.endDate).not.toBeNull();
    expect(closedCycle?.totalYield).toBeCloseTo(15 + 12 + 20 + 18, 5);
    expect(closedCycle?.peakYield).toBeCloseTo(38, 5); // day with 20+18
    expect(closedCycle?.avgDailyYield).toBeCloseTo((15 + 12 + 20 + 18) / 2, 5);

    const updatedAnimal = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updatedAnimal.lactationState).toBe("DRY");
  });

  it("increments cycle number across a second lactation", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, { breedingState: "PREGNANT", lactationNumber: 1 });

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, { animalId: animal.id, type: "CALVING", eventDate: daysAgo(5) });
    });

    const cycle = await prisma.lactationCycle.findFirst({ where: { animalId: animal.id } });
    expect(cycle?.cycleNumber).toBe(2);
  });
});

describe("lactation state machine — timer-driven DIM state and anomaly detection", () => {
  it("advances Fresh -> Peak -> Mid -> Late as DIM crosses configured thresholds", async () => {
    const { farm, params } = await makeFarm({ freshLactationDays: 21, peakLactationDays: 100, midLactationDays: 200 });

    const freshAnimal = await makeAnimal(farm.id, { earTag: "A1" });
    await prisma.lactationCycle.create({
      data: { animalId: freshAnimal.id, cycleNumber: 1, startDate: daysAgo(10), colostrumEndDate: daysAgo(6), state: "FRESH" },
    });

    const peakAnimal = await makeAnimal(farm.id, { earTag: "A2" });
    await prisma.lactationCycle.create({
      data: { animalId: peakAnimal.id, cycleNumber: 1, startDate: daysAgo(50), colostrumEndDate: daysAgo(46), state: "FRESH" },
    });

    const lateAnimal = await makeAnimal(farm.id, { earTag: "A3" });
    await prisma.lactationCycle.create({
      data: { animalId: lateAnimal.id, cycleNumber: 1, startDate: daysAgo(250), colostrumEndDate: daysAgo(246), state: "FRESH" },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, freshAnimal, params);
      await evaluateLactationTimers(tx, peakAnimal, params);
      await evaluateLactationTimers(tx, lateAnimal, params);
    });

    const freshCycle = await prisma.lactationCycle.findFirst({ where: { animalId: freshAnimal.id } });
    const peakCycle = await prisma.lactationCycle.findFirst({ where: { animalId: peakAnimal.id } });
    const lateCycle = await prisma.lactationCycle.findFirst({ where: { animalId: lateAnimal.id } });

    expect(freshCycle?.state).toBe("FRESH");
    expect(peakCycle?.state).toBe("PEAK");
    expect(lateCycle?.state).toBe("LATE_LACTATION");

    const updatedPeakAnimal = await prisma.animal.findUniqueOrThrow({ where: { id: peakAnimal.id } });
    expect(updatedPeakAnimal.lactationState).toBe("PEAK");
  });

  it("raises a yield-drop alert when a Peak-lactation animal's daily yield falls sharply", async () => {
    const { farm, params } = await makeFarm({ yieldDropThresholdPct: 18 });
    const animal = await makeAnimal(farm.id);
    await prisma.lactationCycle.create({
      data: { animalId: animal.id, cycleNumber: 1, startDate: daysAgo(50), colostrumEndDate: daysAgo(46), state: "PEAK" },
    });

    // Prior 3 days averaging 25L, latest day dropped to 14L (~44% drop).
    await prisma.milkRecord.createMany({
      data: [
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(4), session: "MORNING", yieldLiters: 13 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(4), session: "EVENING", yieldLiters: 12 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(3), session: "MORNING", yieldLiters: 13 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(3), session: "EVENING", yieldLiters: 13 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(2), session: "MORNING", yieldLiters: 12 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(2), session: "EVENING", yieldLiters: 12 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(1), session: "MORNING", yieldLiters: 7 },
        { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(1), session: "EVENING", yieldLiters: 7 },
      ],
    });

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "YIELD_DROP" } });
    expect(alert?.status).toBe("PENDING");
    expect(alert?.urgency).toBe("HIGH");
  });

  it("does not raise a yield-drop alert when yield is stable", async () => {
    const { farm, params } = await makeFarm({ yieldDropThresholdPct: 18 });
    const animal = await makeAnimal(farm.id);
    await prisma.lactationCycle.create({
      data: { animalId: animal.id, cycleNumber: 1, startDate: daysAgo(50), colostrumEndDate: daysAgo(46), state: "PEAK" },
    });

    for (let d = 4; d >= 1; d--) {
      await prisma.milkRecord.createMany({
        data: [
          { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(d), session: "MORNING", yieldLiters: 13 },
          { farmId: farm.id, animalId: animal.id, recordDate: daysAgo(d), session: "EVENING", yieldLiters: 12 },
        ],
      });
    }

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "YIELD_DROP" } });
    expect(alert).toBeNull();
  });

  it("raises a missing-milk-data alert once past colostrum with no recent records", async () => {
    const { farm, params } = await makeFarm({ missingMilkDataDays: 2 });
    const animal = await makeAnimal(farm.id);
    await prisma.lactationCycle.create({
      data: { animalId: animal.id, cycleNumber: 1, startDate: daysAgo(30), colostrumEndDate: daysAgo(26), state: "MID_LACTATION" },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "MISSING_MILK_DATA" } });
    expect(alert?.status).toBe("PENDING");
  });

  it("does not raise missing-milk-data while still within the colostrum window", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id);
    await prisma.lactationCycle.create({
      data: { animalId: animal.id, cycleNumber: 1, startDate: daysAgo(2), colostrumEndDate: daysAgo(-2), state: "FRESH" },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "MISSING_MILK_DATA" } });
    expect(alert).toBeNull();
  });

  it("raises a DIM-based dry-off recommendation once past the target dry-off day", async () => {
    const { farm, params } = await makeFarm({ targetDryOffDim: 305 });
    const animal = await makeAnimal(farm.id);
    await prisma.lactationCycle.create({
      data: { animalId: animal.id, cycleNumber: 1, startDate: daysAgo(310), colostrumEndDate: daysAgo(306), state: "LATE_LACTATION" },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "DRY_OFF_DUE" } });
    expect(alert?.status).toBe("PENDING");
  });

  it("is a no-op when there is no open lactation cycle", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id);

    await prisma.$transaction(async (tx) => {
      await evaluateLactationTimers(tx, animal, params);
    });

    const alerts = await prisma.alert.findMany({ where: { animalId: animal.id } });
    expect(alerts).toHaveLength(0);
  });
});

describe("lactationService helper functions directly", () => {
  it("startLactationCycle sets colostrumEndDate from params.colostrumDays", async () => {
    const { farm, params } = await makeFarm({ colostrumDays: 5 });
    const animal = await makeAnimal(farm.id, { lactationNumber: 0 });
    const startDate = daysAgo(1);

    await prisma.$transaction(async (tx) => {
      await startLactationCycle(tx, animal, params, startDate);
    });

    const cycle = await prisma.lactationCycle.findFirstOrThrow({ where: { animalId: animal.id } });
    const expectedColostrumEnd = new Date(startDate.getTime() + 5 * 86_400_000);
    expect(cycle.colostrumEndDate.toISOString()).toBe(expectedColostrumEnd.toISOString());
  });

  it("closeLactationCycle is a no-op when there is no open cycle", async () => {
    const { farm } = await makeFarm();
    const animal = await makeAnimal(farm.id);

    await prisma.$transaction(async (tx) => {
      await closeLactationCycle(tx, animal, new Date());
    });

    const cycles = await prisma.lactationCycle.findMany({ where: { animalId: animal.id } });
    expect(cycles).toHaveLength(0);
  });
});
