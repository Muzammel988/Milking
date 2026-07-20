import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";

export const locationsRouter = Router();

const createLocationSchema = z.object({
  farmId: z.string().min(1),
  barnName: z.string().min(1),
  stallName: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

locationsRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  const locations = await prisma.location.findMany({ where: farmId ? { farmId } : undefined });
  res.json(locations);
});

locationsRouter.post("/", async (req, res) => {
  const parsed = createLocationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const location = await prisma.location.create({ data: parsed.data });
  res.status(201).json(location);
});
