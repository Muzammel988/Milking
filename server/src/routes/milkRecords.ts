import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const milkRecordsRouter = Router();

const createSchema = z.object({
  farmId: z.string().min(1),
  animalId: z.string().optional(),
  recordDate: z.coerce.date(),
  session: z.enum(["MORNING", "MIDDAY", "EVENING"]),
  yieldLiters: z.number().positive(),
  fatPct: z.number().min(0).max(100).optional(),
  proteinPct: z.number().min(0).max(100).optional(),
  somaticCellCount: z.number().int().nonnegative().optional(),
});

milkRecordsRouter.get("/", async (req, res) => {
  const { farmId, animalId, from, to } = req.query as Record<string, string | undefined>;
  const records = await prisma.milkRecord.findMany({
    where: {
      farmId,
      animalId,
      recordDate: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    orderBy: { recordDate: "desc" },
  });
  res.json(records);
});

milkRecordsRouter.post("/", requirePermission("MILK"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const record = await prisma.milkRecord.create({ data: parsed.data });
  res.status(201).json(record);
});
