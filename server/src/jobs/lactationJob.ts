import type { PrismaClient } from "@prisma/client";
import { evaluateLactationTimers } from "../services/lactationService.js";

/** Nightly job: advances DIM-based lactation state and evaluates yield-drop / missing-data alerts for every animal with an open lactation cycle. */
export async function runLactationJob(prisma: PrismaClient, now: Date = new Date()) {
  const farms = await prisma.farm.findMany({ include: { systemParameters: true } });
  let evaluated = 0;

  for (const farm of farms) {
    const params = farm.systemParameters;
    if (!params) continue;

    const animals = await prisma.animal.findMany({
      where: { farmId: farm.id, lactationCycles: { some: { endDate: null } } },
    });

    for (const animal of animals) {
      await prisma.$transaction(async (tx) => {
        await evaluateLactationTimers(tx, animal, params, now);
      });
      evaluated++;
    }
  }

  return { farmsEvaluated: farms.length, animalsEvaluated: evaluated };
}
