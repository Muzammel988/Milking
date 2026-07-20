import type { PrismaClient } from "@prisma/client";
import { evaluateReproductionTimers } from "../services/reproductionStateMachine.js";

/**
 * Nightly job: walks every non-culled animal on every farm and applies
 * timer-based reproduction-state transitions + alert generation. Designed
 * to be triggered by a scheduler (cron) or on-demand via POST /jobs/reproduction.
 */
export async function runReproductionJob(prisma: PrismaClient, now: Date = new Date()) {
  const farms = await prisma.farm.findMany({ include: { systemParameters: true } });
  let evaluated = 0;

  for (const farm of farms) {
    const params = farm.systemParameters;
    if (!params) continue;

    const animals = await prisma.animal.findMany({
      where: { farmId: farm.id, breedingState: { notIn: ["CULLED", "NOT_APPLICABLE"] } },
    });

    for (const animal of animals) {
      await prisma.$transaction(async (tx) => {
        await evaluateReproductionTimers(tx, animal, params, now);
      });
      evaluated++;
    }
  }

  return { farmsEvaluated: farms.length, animalsEvaluated: evaluated };
}
