import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const semenStrawsRouter = Router();

const createSchema = z.object({
  farmId: z.string().min(1),
  sireName: z.string().min(1),
  breed: z.string().min(1),
  strawIdentifier: z.string().min(1),
  quantityOnHand: z.number().int().nonnegative().default(0),
  costPerStraw: z.number().nonnegative().default(0),
});

semenStrawsRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  res.json(await prisma.semenStraw.findMany({ where: farmId ? { farmId } : undefined, orderBy: { sireName: "asc" } }));
});

semenStrawsRouter.post("/", requirePermission("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(await prisma.semenStraw.create({ data: parsed.data }));
});
