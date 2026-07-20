import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const healthEventsRouter = Router();

const DAY_MS = 24 * 60 * 60 * 1000;

const createSchema = z.object({
  animalId: z.string().min(1),
  type: z.enum(["EXAMINATION", "DIAGNOSIS", "TREATMENT", "VACCINATION"]),
  eventDate: z.coerce.date(),
  medicineId: z.string().optional(),
  vaccineId: z.string().optional(),
  dosage: z.string().optional(),
  cost: z.number().nonnegative().optional(),
  operatorId: z.string().optional(),
  notes: z.string().optional(),
  withdrawalPeriodDaysOverride: z.number().int().nonnegative().optional(),
});

healthEventsRouter.get("/", async (req, res) => {
  const animalId = req.query.animalId as string | undefined;
  const events = await prisma.healthEvent.findMany({
    where: animalId ? { animalId } : undefined,
    include: { medicine: true, vaccine: true, operator: true },
    orderBy: { eventDate: "desc" },
  });
  res.json(events);
});

healthEventsRouter.post("/", requirePermission("HEALTH"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const [medicine, vaccine] = await Promise.all([
    input.medicineId ? prisma.medicine.findUnique({ where: { id: input.medicineId } }) : null,
    input.vaccineId ? prisma.vaccine.findUnique({ where: { id: input.vaccineId } }) : null,
  ]);

  const withdrawalPeriodDays =
    input.withdrawalPeriodDaysOverride ?? medicine?.defaultWithdrawalPeriodDays ?? vaccine?.defaultWithdrawalPeriodDays ?? 0;
  const withdrawalEndDate = withdrawalPeriodDays > 0 ? new Date(input.eventDate.getTime() + withdrawalPeriodDays * DAY_MS) : null;
  const cost = input.cost ?? medicine?.unitCost ?? vaccine?.unitCost ?? undefined;

  const animal = await prisma.animal.findUnique({ where: { id: input.animalId } });
  if (!animal) return res.status(404).json({ error: "Animal not found" });

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.healthEvent.create({
      data: {
        animalId: input.animalId,
        type: input.type,
        eventDate: input.eventDate,
        medicineId: input.medicineId,
        vaccineId: input.vaccineId,
        dosage: input.dosage,
        cost,
        operatorId: input.operatorId,
        notes: input.notes,
        withdrawalPeriodDays: withdrawalPeriodDays || null,
        withdrawalEndDate,
      },
      include: { medicine: true, vaccine: true },
    });

    if (cost) {
      await tx.financialTransaction.create({
        data: {
          farmId: animal.farmId,
          date: input.eventDate,
          type: "EXPENSE",
          category: "VET_COST",
          amount: cost,
          animalId: input.animalId,
          notes: `${input.type} — ${medicine?.name ?? vaccine?.name ?? "health event"}`,
        },
      });
    }

    return created;
  });

  res.status(201).json(event);
});
