import { PrismaClient } from "@prisma/client";
import { applyBreedingEvent } from "../src/services/reproductionStateMachine.js";

const prisma = new PrismaClient();

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  const farm = await prisma.farm.create({
    data: {
      name: "Green Valley Dairy",
      ownerName: "Muzammel Nawaz",
      baseCurrency: "USD",
      systemParameters: { create: {} },
    },
    include: { systemParameters: true },
  });

  const location = await prisma.location.create({
    data: { farmId: farm.id, barnName: "Barn A", stallName: "1" },
  });

  const herdsman = await prisma.user.create({
    data: { farmId: farm.id, name: "Ali Herdsman", email: "ali@greenvalley.test", role: "HERDSMAN" },
  });

  const params = farm.systemParameters!;

  // Cow 1: recently calved, still in Fresh/Voluntary Wait.
  const cow1 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      earTag: "GV-001",
      name: "Bella",
      breed: "Holstein",
      sex: "FEMALE",
      birthDate: daysAgo(1200),
      origin: "BORN_ON_FARM",
      status: "COW",
      locationId: location.id,
      breedingState: "OPEN",
    },
  });

  // Cow 2: open, ready to breed (walk through the full cycle via events).
  const cow2 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      earTag: "GV-002",
      name: "Daisy",
      breed: "Holstein",
      sex: "FEMALE",
      birthDate: daysAgo(1000),
      origin: "BORN_ON_FARM",
      status: "COW",
      locationId: location.id,
      breedingState: "OPEN",
    },
  });

  // Cow 3: currently pregnant, close to calving.
  const cow3 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      earTag: "GV-003",
      name: "Rosie",
      breed: "Jersey",
      sex: "FEMALE",
      birthDate: daysAgo(1500),
      origin: "PURCHASED",
      status: "COW",
      locationId: location.id,
      breedingState: "OPEN",
    },
  });

  await prisma.$transaction(async (tx) => {
    // cow1: calved 10 days ago -> Fresh
    await applyBreedingEvent(tx, cow1, params, {
      animalId: cow1.id,
      type: "CALVING",
      eventDate: daysAgo(10),
      notes: "Seed data: normal calving",
    });

    // cow2: heat -> insemination -> positive pregnancy check (~250 days ago insemination)
    let cow2State = await tx.animal.findUniqueOrThrow({ where: { id: cow2.id } });
    await applyBreedingEvent(tx, cow2State, params, {
      animalId: cow2.id,
      type: "HEAT_OBSERVED",
      eventDate: daysAgo(2),
    });
    cow2State = await tx.animal.findUniqueOrThrow({ where: { id: cow2.id } });
    await applyBreedingEvent(tx, cow2State, params, {
      animalId: cow2.id,
      type: "INSEMINATION",
      eventDate: daysAgo(2),
      semenOrSireRef: "Straw-ABC-123",
    });

    // cow3: inseminated ~260 days ago, confirmed pregnant -> should be Close to Calving after nightly job
    let cow3State = await tx.animal.findUniqueOrThrow({ where: { id: cow3.id } });
    await applyBreedingEvent(tx, cow3State, params, {
      animalId: cow3.id,
      type: "INSEMINATION",
      eventDate: daysAgo(260),
      semenOrSireRef: "Straw-XYZ-789",
    });
    cow3State = await tx.animal.findUniqueOrThrow({ where: { id: cow3.id } });
    await applyBreedingEvent(tx, cow3State, params, {
      animalId: cow3.id,
      type: "PREGNANCY_CHECK",
      eventDate: daysAgo(228),
      result: "POSITIVE",
    });
  });

  console.log(`Seeded farm ${farm.id} with 3 animals, 1 location, 1 user.`);
  console.log(`Herdsman: ${herdsman.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
