import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const usersRouter = Router();

const createUserSchema = z.object({
  farmId: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "MANAGER", "VET", "HERDSMAN", "MILKER"]),
});

usersRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  const users = await prisma.user.findMany({ where: farmId ? { farmId } : undefined });
  res.json(users);
});

usersRouter.post("/", requirePermission("ADMIN"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.create({ data: parsed.data });
  res.status(201).json(user);
});
