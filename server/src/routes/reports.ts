import { Router } from "express";
import { prisma } from "../db.js";

export const reportsRouter = Router();

async function computeProfitability(farmId: string, animalId?: string) {
  const transactions = await prisma.financialTransaction.groupBy({
    by: ["animalId", "type"],
    where: { farmId, animalId: animalId ?? { not: null } },
    _sum: { amount: true },
  });

  const byAnimal = new Map<string, { income: number; expense: number }>();
  for (const t of transactions) {
    if (!t.animalId) continue;
    const entry = byAnimal.get(t.animalId) ?? { income: 0, expense: 0 };
    if (t.type === "INCOME") entry.income += t._sum.amount ?? 0;
    else entry.expense += t._sum.amount ?? 0;
    byAnimal.set(t.animalId, entry);
  }

  const animalIds = [...byAnimal.keys()];
  const animals = await prisma.animal.findMany({
    where: { id: { in: animalIds } },
    select: { id: true, earTag: true, name: true },
  });
  const animalById = new Map(animals.map((a) => [a.id, a]));

  return animalIds
    .map((id) => ({
      animal: animalById.get(id) ?? null,
      income: byAnimal.get(id)!.income,
      expense: byAnimal.get(id)!.expense,
      netProfit: byAnimal.get(id)!.income - byAnimal.get(id)!.expense,
    }))
    .sort((a, b) => b.netProfit - a.netProfit);
}

/** Per-animal profit & loss: milk-sale income minus feed/vet/insemination costs linked to that animal. */
reportsRouter.get("/farms/:farmId/profitability", async (req, res) => {
  res.json(await computeProfitability(req.params.farmId));
});

reportsRouter.get("/animals/:animalId/profitability", async (req, res) => {
  const animal = await prisma.animal.findUnique({ where: { id: req.params.animalId } });
  if (!animal) return res.status(404).json({ error: "Not found" });
  const rows = await computeProfitability(animal.farmId, animal.id);
  res.json(rows[0] ?? { animal: { id: animal.id, earTag: animal.earTag, name: animal.name }, income: 0, expense: 0, netProfit: 0 });
});

/** Herd status distribution (calf/heifer/cow/dry/sold/dead/slaughtered). */
reportsRouter.get("/farms/:farmId/status-distribution", async (req, res) => {
  const rows = await prisma.animal.groupBy({
    by: ["status"],
    where: { farmId: req.params.farmId },
    _count: { _all: true },
  });
  res.json(rows.map((r) => ({ status: r.status, count: r._count._all })));
});

/** Breakdown of why animals left the herd (sale/death/slaughter) — a common report the current product tracks manually. */
reportsRouter.get("/farms/:farmId/exit-reasons", async (req, res) => {
  const rows = await prisma.animal.groupBy({
    by: ["exitReason"],
    where: { farmId: req.params.farmId, exitReason: { not: null } },
    _count: { _all: true },
  });
  res.json(rows.map((r) => ({ exitReason: r.exitReason, count: r._count._all })));
});

/**
 * Average yield by day-in-milk bucket across every lactation cycle on the
 * farm — the herd's lactation curve, computed from MilkRecord + the cycle's
 * startDate rather than stored redundantly.
 */
reportsRouter.get("/farms/:farmId/lactation-curve", async (req, res) => {
  const bucketSizeDays = 10;
  const cycles = await prisma.lactationCycle.findMany({
    where: { animal: { farmId: req.params.farmId } },
    include: { animal: { select: { id: true } } },
  });
  if (cycles.length === 0) return res.json([]);

  const records = await prisma.milkRecord.findMany({
    where: { animalId: { in: cycles.map((c) => c.animal.id) } },
  });

  const dailyByAnimal = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!r.animalId) continue;
    const perDay = dailyByAnimal.get(r.animalId) ?? new Map<string, number>();
    const key = r.recordDate.toISOString().slice(0, 10);
    perDay.set(key, (perDay.get(key) ?? 0) + r.yieldLiters);
    dailyByAnimal.set(r.animalId, perDay);
  }

  const bucketTotals = new Map<number, { sum: number; count: number }>();
  for (const cycle of cycles) {
    const perDay = dailyByAnimal.get(cycle.animalId);
    if (!perDay) continue;
    for (const [dayKey, total] of perDay) {
      const dim = Math.floor((new Date(dayKey).getTime() - cycle.startDate.getTime()) / 86_400_000);
      if (dim < 0) continue;
      const bucket = Math.floor(dim / bucketSizeDays) * bucketSizeDays;
      const entry = bucketTotals.get(bucket) ?? { sum: 0, count: 0 };
      entry.sum += total;
      entry.count += 1;
      bucketTotals.set(bucket, entry);
    }
  }

  const curve = [...bucketTotals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dimBucketStart, { sum, count }]) => ({ dimBucketStart, avgYieldLiters: sum / count, sampleDays: count }));

  res.json(curve);
});

/** Insemination and calving history — filterable by type and date range. */
reportsRouter.get("/farms/:farmId/breeding-history", async (req, res) => {
  const { type, from, to } = req.query as Record<string, string | undefined>;
  const events = await prisma.breedingEvent.findMany({
    where: {
      animal: { farmId: req.params.farmId },
      type: type as never,
      eventDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    include: { animal: { select: { id: true, earTag: true, name: true } }, operator: true },
    orderBy: { eventDate: "desc" },
  });
  res.json(events);
});
