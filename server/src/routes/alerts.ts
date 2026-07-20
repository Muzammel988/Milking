import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuthenticated } from "../middleware/permissions.js";

export const alertsRouter = Router();

alertsRouter.get("/", async (req, res) => {
  const { farmId, status, urgency, animalId } = req.query as Record<string, string | undefined>;
  const alerts = await prisma.alert.findMany({
    where: {
      status: status as never,
      urgency: urgency as never,
      animalId,
      animal: farmId ? { farmId } : undefined,
    },
    include: { animal: { select: { id: true, earTag: true, name: true } } },
    orderBy: [{ urgency: "asc" }, { dueDate: "asc" }],
  });
  res.json(alerts);
});

const resolveSchema = z.object({
  status: z.enum(["DONE", "DISMISSED"]),
  resolvedById: z.string().optional(),
});

alertsRouter.patch("/:id", requireAuthenticated, async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const alert = await prisma.alert.update({
    where: { id: req.params.id },
    data: {
      status: parsed.data.status,
      resolvedAt: new Date(),
      resolvedById: parsed.data.resolvedById ?? req.currentUser!.id,
    },
  });
  res.json(alert);
});
