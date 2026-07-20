import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const medicinesRouter = Router();
export const vaccinesRouter = Router();

const catalogSchema = z.object({
  farmId: z.string().min(1),
  name: z.string().min(1),
  type: z.string().min(1),
  defaultWithdrawalPeriodDays: z.number().int().nonnegative().default(0),
  unitCost: z.number().nonnegative().default(0),
});

medicinesRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  res.json(await prisma.medicine.findMany({ where: farmId ? { farmId } : undefined, orderBy: { name: "asc" } }));
});

medicinesRouter.post("/", requirePermission("ADMIN"), async (req, res) => {
  const parsed = catalogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(await prisma.medicine.create({ data: parsed.data }));
});

vaccinesRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  res.json(await prisma.vaccine.findMany({ where: farmId ? { farmId } : undefined, orderBy: { name: "asc" } }));
});

vaccinesRouter.post("/", requirePermission("ADMIN"), async (req, res) => {
  const parsed = catalogSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(await prisma.vaccine.create({ data: parsed.data }));
});
