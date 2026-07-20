import { beforeEach, afterAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import {
  applyBreedingEvent,
  evaluateReproductionTimers,
  InvalidTransitionError,
} from "../src/services/reproductionStateMachine.js";
import type { Animal, SystemParameters } from "@prisma/client";

async function resetDb() {
  await prisma.alert.deleteMany();
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
    data: {
      name: "Test Farm",
      ownerName: "Tester",
      systemParameters: { create: paramOverrides },
    },
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
      birthDate: new Date("2022-01-01"),
      origin: "BORN_ON_FARM",
      status: "COW",
      breedingState: "OPEN",
      ...overrides,
    },
  });
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function daysFromNow(n: number): Date {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
}

beforeEach(resetDb);
afterAll(async () => {
  await resetDb();
  await prisma.$disconnect();
});

describe("reproduction state machine — event-driven transitions", () => {
  it("walks the full happy path: Open -> In Heat -> Inseminated -> Pregnant, with alerts", async () => {
    const { farm, params } = await makeFarm();
    let animal = await makeAnimal(farm.id);

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, {
        animalId: animal.id,
        type: "HEAT_OBSERVED",
        eventDate: new Date(),
      });
    });
    animal = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(animal.breedingState).toBe("IN_HEAT");
    let heatAlert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "IN_HEAT" } });
    expect(heatAlert?.status).toBe("PENDING");

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, {
        animalId: animal.id,
        type: "INSEMINATION",
        eventDate: new Date(),
      });
    });
    animal = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(animal.breedingState).toBe("INSEMINATED");
    heatAlert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "IN_HEAT" } });
    expect(heatAlert?.status).toBe("DONE");
    const pregCheckAlert = await prisma.alert.findFirst({
      where: { animalId: animal.id, type: "PREGNANCY_CHECK_DUE" },
    });
    expect(pregCheckAlert?.status).toBe("PENDING");

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, {
        animalId: animal.id,
        type: "PREGNANCY_CHECK",
        eventDate: new Date(),
        result: "POSITIVE",
      });
    });
    animal = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(animal.breedingState).toBe("PREGNANT");
    expect(animal.expectedCalvingDate).not.toBeNull();

    const dryOffAlert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "DRY_OFF_DUE" } });
    const closeToCalvingAlert = await prisma.alert.findFirst({
      where: { animalId: animal.id, type: "CLOSE_TO_CALVING" },
    });
    expect(dryOffAlert?.status).toBe("PENDING");
    expect(closeToCalvingAlert?.status).toBe("PENDING");

    const resolvedPregCheck = await prisma.alert.findFirst({
      where: { animalId: animal.id, type: "PREGNANCY_CHECK_DUE" },
    });
    expect(resolvedPregCheck?.status).toBe("DONE");
  });

  it("negative pregnancy check returns the animal to Open and regenerates ready-to-breed", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, {
      breedingState: "INSEMINATED",
      lastInseminationDate: daysAgo(32),
    });

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, {
        animalId: animal.id,
        type: "PREGNANCY_CHECK",
        eventDate: new Date(),
        result: "NEGATIVE",
      });
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updated.breedingState).toBe("OPEN");
    const readyAlert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "READY_TO_BREED" } });
    expect(readyAlert?.status).toBe("PENDING");
  });

  it("abortion returns a pregnant animal to Open and clears pregnancy fields", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, {
      breedingState: "PREGNANT",
      lastInseminationDate: daysAgo(100),
      expectedCalvingDate: daysFromNow(180),
    });

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, animal, params, {
        animalId: animal.id,
        type: "ABORTION",
        eventDate: new Date(),
      });
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updated.breedingState).toBe("OPEN");
    expect(updated.expectedCalvingDate).toBeNull();
  });

  it("calving closes the loop: Fresh state, incremented lactation number, resolved pregnancy alerts", async () => {
    const { farm, params } = await makeFarm();
    const dam = await makeAnimal(farm.id, {
      breedingState: "CLOSE_TO_CALVING",
      lactationNumber: 1,
      status: "COW",
    });
    await prisma.alert.create({
      data: { animalId: dam.id, type: "CLOSE_TO_CALVING", urgency: "NORMAL", dueDate: new Date(), message: "x" },
    });

    await prisma.$transaction(async (tx) => {
      await applyBreedingEvent(tx, dam, params, {
        animalId: dam.id,
        type: "CALVING",
        eventDate: new Date(),
      });
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: dam.id } });
    expect(updated.breedingState).toBe("FRESH");
    expect(updated.lactationNumber).toBe(2);
    const closeAlert = await prisma.alert.findFirst({ where: { animalId: dam.id, type: "CLOSE_TO_CALVING" } });
    expect(closeAlert?.status).toBe("DONE");
    const postpartum = await prisma.alert.findFirst({ where: { animalId: dam.id, type: "POSTPARTUM_CHECK" } });
    expect(postpartum?.status).toBe("PENDING");
  });

  it("rejects dry-off from a state where it makes no sense", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, { breedingState: "OPEN" });

    await expect(
      prisma.$transaction(async (tx) => {
        await applyBreedingEvent(tx, animal, params, {
          animalId: animal.id,
          type: "DRY_OFF",
          eventDate: new Date(),
        });
      })
    ).rejects.toThrow(InvalidTransitionError);
  });

  it("rejects any breeding event recorded against a culled animal", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, { breedingState: "CULLED" });

    await expect(
      prisma.$transaction(async (tx) => {
        await applyBreedingEvent(tx, animal, params, {
          animalId: animal.id,
          type: "HEAT_OBSERVED",
          eventDate: new Date(),
        });
      })
    ).rejects.toThrow(InvalidTransitionError);
  });
});

describe("reproduction state machine — timer-driven transitions", () => {
  it("moves Fresh -> Voluntary Wait -> Open as the postpartum/voluntary-wait windows elapse", async () => {
    const { farm, params } = await makeFarm({ postpartumCheckDay: 12, voluntaryWaitDays: 50 });

    const midWindow = await makeAnimal(farm.id, {
      earTag: "A1",
      breedingState: "FRESH",
      lastCalvingDate: daysAgo(20),
    });
    const pastWindow = await makeAnimal(farm.id, {
      earTag: "A2",
      breedingState: "FRESH",
      lastCalvingDate: daysAgo(60),
    });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, midWindow, params);
      await evaluateReproductionTimers(tx, pastWindow, params);
    });

    const midUpdated = await prisma.animal.findUniqueOrThrow({ where: { id: midWindow.id } });
    const pastUpdated = await prisma.animal.findUniqueOrThrow({ where: { id: pastWindow.id } });
    expect(midUpdated.breedingState).toBe("VOLUNTARY_WAIT");
    expect(pastUpdated.breedingState).toBe("OPEN");

    const readyAlert = await prisma.alert.findFirst({ where: { animalId: pastWindow.id, type: "READY_TO_BREED" } });
    expect(readyAlert?.status).toBe("PENDING");
  });

  it("raises an open-too-long alert once the threshold is exceeded", async () => {
    const { farm, params } = await makeFarm({ openTooLongDays: 75 });
    const animal = await makeAnimal(farm.id, { breedingState: "OPEN", lastCalvingDate: daysAgo(80) });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, animal, params);
    });

    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "OPEN_TOO_LONG" } });
    expect(alert?.status).toBe("PENDING");
    expect(alert?.urgency).toBe("HIGH");
  });

  it("returns an animal to Open and dismisses the alert when the heat window expires unbred", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, {
      breedingState: "IN_HEAT",
      heatWindowExpiresAt: daysAgo(1),
    });
    await prisma.alert.create({
      data: { animalId: animal.id, type: "IN_HEAT", urgency: "URGENT", dueDate: daysAgo(1), message: "x" },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, animal, params);
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updated.breedingState).toBe("OPEN");
    const alert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "IN_HEAT" } });
    expect(alert?.status).toBe("DISMISSED");
  });

  it("escalates an overdue pregnancy-check alert", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, {
      breedingState: "INSEMINATED",
      lastInseminationDate: daysAgo(40),
    });
    await prisma.alert.create({
      data: {
        animalId: animal.id,
        type: "PREGNANCY_CHECK_DUE",
        urgency: "NORMAL",
        dueDate: daysAgo(5),
        message: "due",
      },
    });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, animal, params);
    });

    const dueAlert = await prisma.alert.findFirst({ where: { animalId: animal.id, type: "PREGNANCY_CHECK_DUE" } });
    const overdueAlert = await prisma.alert.findFirst({
      where: { animalId: animal.id, type: "PREGNANCY_CHECK_OVERDUE" },
    });
    expect(dueAlert?.status).toBe("DONE");
    expect(overdueAlert?.status).toBe("PENDING");
    expect(overdueAlert?.urgency).toBe("HIGH");
  });

  it("moves Pregnant -> Close to Calving once within the configured offset of the expected calving date", async () => {
    const { farm, params } = await makeFarm({ closeToCalvingOffsetDays: 21 });
    const animal = await makeAnimal(farm.id, {
      breedingState: "PREGNANT",
      expectedCalvingDate: daysFromNow(15),
    });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, animal, params);
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updated.breedingState).toBe("CLOSE_TO_CALVING");
  });

  it("is a no-op for Culled animals", async () => {
    const { farm, params } = await makeFarm();
    const animal = await makeAnimal(farm.id, { breedingState: "CULLED" });

    await prisma.$transaction(async (tx) => {
      await evaluateReproductionTimers(tx, animal, params);
    });

    const updated = await prisma.animal.findUniqueOrThrow({ where: { id: animal.id } });
    expect(updated.breedingState).toBe("CULLED");
  });
});
