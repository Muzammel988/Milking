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

  const [owner, manager, herdsman, milker, vet] = await Promise.all([
    prisma.user.create({ data: { farmId: farm.id, name: "Muzammel Nawaz", email: "owner@greenvalley.test", role: "OWNER" } }),
    prisma.user.create({ data: { farmId: farm.id, name: "Priya Manager", email: "manager@greenvalley.test", role: "MANAGER" } }),
    prisma.user.create({ data: { farmId: farm.id, name: "Ali Herdsman", email: "ali@greenvalley.test", role: "HERDSMAN" } }),
    prisma.user.create({ data: { farmId: farm.id, name: "Sam Milker", email: "sam@greenvalley.test", role: "MILKER" } }),
    prisma.user.create({ data: { farmId: farm.id, name: "Dr. Vet", email: "vet@greenvalley.test", role: "VET" } }),
  ]);

  const params = farm.systemParameters!;

  // --- Catalogs -------------------------------------------------------
  const penicillin = await prisma.medicine.create({
    data: { farmId: farm.id, name: "Penicillin", type: "Antibiotic", defaultWithdrawalPeriodDays: 5, unitCost: 12 },
  });
  await prisma.medicine.create({
    data: { farmId: farm.id, name: "Ivermectin", type: "Dewormer", defaultWithdrawalPeriodDays: 21, unitCost: 8 },
  });
  const bvdVaccine = await prisma.vaccine.create({
    data: { farmId: farm.id, name: "BVD Vaccine", type: "Viral", defaultWithdrawalPeriodDays: 0, unitCost: 15 },
  });

  const cornSilage = await prisma.feedIngredient.create({
    data: { farmId: farm.id, name: "Corn Silage", unitOfMeasure: "kg", costPerUnit: 0.15, stockQuantity: 5000 },
  });
  const alfalfaHay = await prisma.feedIngredient.create({
    data: { farmId: farm.id, name: "Alfalfa Hay", unitOfMeasure: "kg", costPerUnit: 0.25, stockQuantity: 3000 },
  });
  const concentrate = await prisma.feedIngredient.create({
    data: { farmId: farm.id, name: "Dairy Concentrate", unitOfMeasure: "kg", costPerUnit: 0.4, stockQuantity: 50 },
  });

  const lactatingRation = await prisma.rationFormula.create({
    data: {
      farmId: farm.id,
      name: "Lactating TMR",
      targetGroup: "LACTATING",
      ingredients: {
        create: [
          { feedIngredientId: cornSilage.id, quantityPerHeadPerDay: 20 },
          { feedIngredientId: alfalfaHay.id, quantityPerHeadPerDay: 8 },
          { feedIngredientId: concentrate.id, quantityPerHeadPerDay: 6 },
        ],
      },
    },
  });

  const semenStraw = await prisma.semenStraw.create({
    data: { farmId: farm.id, sireName: "Sire X123", breed: "Holstein", strawIdentifier: "Straw-ABC-123", quantityOnHand: 10, costPerStraw: 25 },
  });

  // --- Animals ----------------------------------------------------------

  // Cow 1: recently calved (10 days ago), still Fresh.
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

  // Cow 2: open, walked through heat -> insemination.
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

  // Cow 3: purchased, currently pregnant, close to calving.
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

  // Cow 4: calved 60 days ago — mid-Peak lactation, used to demo the yield-drop anomaly alert.
  const cow4 = await prisma.animal.create({
    data: {
      farmId: farm.id,
      earTag: "GV-004",
      name: "Luna",
      breed: "Holstein",
      sex: "FEMALE",
      birthDate: daysAgo(1400),
      origin: "BORN_ON_FARM",
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

    // cow2: heat -> insemination (drawing from semen inventory)
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
      semenOrSireRef: semenStraw.strawIdentifier,
    });
    await tx.breedingEvent.updateMany({
      where: { animalId: cow2.id, type: "INSEMINATION" },
      data: { semenStrawId: semenStraw.id },
    });
    await tx.semenStraw.update({ where: { id: semenStraw.id }, data: { quantityOnHand: { decrement: 1 } } });

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

    // cow4: calved 60 days ago -> Fresh initially; nightly lactation job advances it to Peak.
    await applyBreedingEvent(tx, cow4, params, {
      animalId: cow4.id,
      type: "CALVING",
      eventDate: daysAgo(60),
      notes: "Seed data: normal calving",
    });
  });

  // --- Milk records -------------------------------------------------
  // cow1: two sessions/day for the last few days.
  for (let d = 9; d >= 1; d--) {
    await prisma.milkRecord.createMany({
      data: [
        { farmId: farm.id, animalId: cow1.id, recordDate: daysAgo(d), session: "MORNING", yieldLiters: 14 + Math.random() },
        { farmId: farm.id, animalId: cow1.id, recordDate: daysAgo(d), session: "EVENING", yieldLiters: 13 + Math.random() },
      ],
    });
  }

  // cow4: steady ~25L/day for the prior few days, then a sharp drop today/yesterday
  // (mastitis-style signal) so the nightly lactation job raises a YIELD_DROP alert.
  const cow4History = [
    { d: 4, liters: 25 },
    { d: 3, liters: 26 },
    { d: 2, liters: 24 },
    { d: 1, liters: 14 },
  ];
  for (const { d, liters } of cow4History) {
    await prisma.milkRecord.createMany({
      data: [
        { farmId: farm.id, animalId: cow4.id, recordDate: daysAgo(d), session: "MORNING", yieldLiters: liters * 0.55 },
        { farmId: farm.id, animalId: cow4.id, recordDate: daysAgo(d), session: "EVENING", yieldLiters: liters * 0.45 },
      ],
    });
  }

  // Bulk-tank entry (not tied to one animal)
  await prisma.milkRecord.create({
    data: { farmId: farm.id, recordDate: daysAgo(1), session: "EVENING", yieldLiters: 310, fatPct: 3.8, proteinPct: 3.2 },
  });

  // --- Health events (also generates linked VET_COST financial transactions) ---
  await prisma.$transaction(async (tx) => {
    const treatment = await tx.healthEvent.create({
      data: {
        animalId: cow1.id,
        type: "TREATMENT",
        eventDate: daysAgo(8),
        medicineId: penicillin.id,
        dosage: "10ml IM",
        cost: penicillin.unitCost,
        operatorId: vet.id,
        notes: "Mild mastitis, treated post-calving",
        withdrawalPeriodDays: penicillin.defaultWithdrawalPeriodDays,
        withdrawalEndDate: new Date(daysAgo(8).getTime() + penicillin.defaultWithdrawalPeriodDays * 86400000),
      },
    });
    await tx.financialTransaction.create({
      data: {
        farmId: farm.id,
        date: treatment.eventDate,
        type: "EXPENSE",
        category: "VET_COST",
        amount: treatment.cost!,
        animalId: cow1.id,
        notes: "Penicillin — Treatment",
      },
    });

    const vaccination = await tx.healthEvent.create({
      data: {
        animalId: cow4.id,
        type: "VACCINATION",
        eventDate: daysAgo(30),
        vaccineId: bvdVaccine.id,
        cost: bvdVaccine.unitCost,
        operatorId: vet.id,
      },
    });
    await tx.financialTransaction.create({
      data: {
        farmId: farm.id,
        date: vaccination.eventDate,
        type: "EXPENSE",
        category: "VET_COST",
        amount: vaccination.cost!,
        animalId: cow4.id,
        notes: "BVD Vaccine — Vaccination",
      },
    });
  });

  // --- Feed consumption (group entry, depletes stock + logs FEED_PURCHASE expense) ---
  for (let d = 3; d >= 1; d--) {
    const formula = await prisma.rationFormula.findUniqueOrThrow({
      where: { id: lactatingRation.id },
      include: { ingredients: { include: { feedIngredient: true } } },
    });
    const headCount = 2; // cow1 + cow4, both currently lactating
    const totalCost = formula.ingredients.reduce((sum, i) => sum + i.quantityPerHeadPerDay * headCount * i.feedIngredient.costPerUnit, 0);

    await prisma.$transaction(async (tx) => {
      for (const line of formula.ingredients) {
        await tx.feedIngredient.update({
          where: { id: line.feedIngredientId },
          data: { stockQuantity: { decrement: line.quantityPerHeadPerDay * headCount } },
        });
      }
      await tx.feedConsumptionRecord.create({
        data: {
          farmId: farm.id,
          rationFormulaId: lactatingRation.id,
          groupLabel: "Lactating cows",
          headCount,
          date: daysAgo(d),
          totalCost,
        },
      });
      await tx.financialTransaction.create({
        data: {
          farmId: farm.id,
          date: daysAgo(d),
          type: "EXPENSE",
          category: "FEED_PURCHASE",
          amount: totalCost,
          animalGroupLabel: "Lactating cows",
          notes: `Feed consumption — ${formula.name}`,
        },
      });
    });
  }

  // --- Other financial transactions (milk sale income, purchase/insemination cost) ---
  await prisma.financialTransaction.createMany({
    data: [
      { farmId: farm.id, date: daysAgo(1), type: "INCOME", category: "MILK_SALE", amount: 340, notes: "Bulk tank pickup" },
      { farmId: farm.id, date: daysAgo(1500), type: "EXPENSE", category: "ANIMAL_PURCHASE", amount: 1800, animalId: cow3.id, notes: "Purchased as bred heifer" },
      { farmId: farm.id, date: daysAgo(2), type: "EXPENSE", category: "INSEMINATION_COST", amount: semenStraw.costPerStraw, animalId: cow2.id, notes: "AI service — Straw-ABC-123" },
      { farmId: farm.id, date: daysAgo(9), type: "INCOME", category: "MILK_SALE", amount: 45, animalId: cow1.id, notes: "Direct milk sale" },
    ],
  });

  console.log(`Seeded farm ${farm.id} with 4 animals, 1 location, 5 users.`);
  console.log(`Owner: ${owner.email} | Manager: ${manager.email} | Herdsman: ${herdsman.email} | Milker: ${milker.email} | Vet: ${vet.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
