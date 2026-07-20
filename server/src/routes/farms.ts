import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const farmsRouter = Router();

const createFarmSchema = z.object({
  name: z.string().min(1),
  ownerName: z.string().min(1),
  address: z.string().optional(),
  baseCurrency: z.string().default("USD"),
});

farmsRouter.get("/", async (_req, res) => {
  const farms = await prisma.farm.findMany();
  res.json(farms);
});

farmsRouter.post("/", async (req, res) => {
  const parsed = createFarmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const farm = await prisma.farm.create({
    data: {
      ...parsed.data,
      systemParameters: { create: {} },
    },
    include: { systemParameters: true },
  });
  res.status(201).json(farm);
});

farmsRouter.get("/:id/system-parameters", async (req, res) => {
  const params = await prisma.systemParameters.findUnique({ where: { farmId: req.params.id } });
  if (!params) return res.status(404).json({ error: "Not found" });
  res.json(params);
});

const updateParamsSchema = z.object({
  voluntaryWaitDays: z.number().int().positive().optional(),
  openTooLongDays: z.number().int().positive().optional(),
  postpartumCheckDay: z.number().int().positive().optional(),
  heatWindowHours: z.number().int().positive().optional(),
  pregnancyCheckDays: z.number().int().positive().optional(),
  confirmatoryCheckDays: z.number().int().positive().optional(),
  gestationLengthDays: z.number().int().positive().optional(),
  dryOffOffsetDays: z.number().int().positive().optional(),
  closeToCalvingOffsetDays: z.number().int().positive().optional(),
});

farmsRouter.put("/:id/system-parameters", async (req, res) => {
  const parsed = updateParamsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const params = await prisma.systemParameters.update({
    where: { farmId: req.params.id },
    data: parsed.data,
  });
  res.json(params);
});

farmsRouter.get("/:id/dashboard", async (req, res) => {
  const farmId = req.params.id;

  const [statusCounts, alerts] = await Promise.all([
    prisma.animal.groupBy({
      by: ["breedingState"],
      where: { farmId },
      _count: { _all: true },
    }),
    prisma.alert.findMany({
      where: { status: "PENDING", animal: { farmId } },
      include: { animal: { select: { id: true, earTag: true, name: true } } },
      orderBy: [{ urgency: "asc" }, { dueDate: "asc" }],
    }),
  ]);

  const urgencyOrder = ["URGENT", "HIGH", "NORMAL", "LOW"] as const;
  const alertsByUrgency = Object.fromEntries(
    urgencyOrder.map((u) => [u, alerts.filter((a) => a.urgency === u)])
  );

  res.json({
    herdCountsByBreedingState: statusCounts.map((s) => ({
      breedingState: s.breedingState,
      count: s._count._all,
    })),
    alertsByUrgency,
    totalPendingAlerts: alerts.length,
  });
});
