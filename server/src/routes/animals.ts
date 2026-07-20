import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const animalsRouter = Router();

const createAnimalSchema = z.object({
  farmId: z.string().min(1),
  earTag: z.string().min(1),
  transponderId: z.string().optional(),
  name: z.string().optional(),
  breed: z.string().min(1),
  sex: z.enum(["MALE", "FEMALE"]),
  birthDate: z.coerce.date(),
  origin: z.enum(["BORN_ON_FARM", "PURCHASED"]),
  damId: z.string().optional(),
  sireId: z.string().optional(),
  sireStrawRef: z.string().optional(),
  status: z.enum(["CALF", "HEIFER", "COW", "DRY"]).default("CALF"),
  locationId: z.string().optional(),
});

animalsRouter.get("/", async (req, res) => {
  const { farmId, status, breedingState } = req.query as Record<string, string | undefined>;
  const animals = await prisma.animal.findMany({
    where: {
      farmId,
      status: status as never,
      breedingState: breedingState as never,
    },
    orderBy: { earTag: "asc" },
  });
  res.json(animals);
});

animalsRouter.post("/", requirePermission("HERD"), async (req, res) => {
  const parsed = createAnimalSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  // Females are treated as breeding-eligible (Open) from creation — heifers
  // are bred before their first calving too. The Fresh/Voluntary-Wait part
  // of the cycle only begins after an actual calving event.
  const breedingState = parsed.data.sex === "FEMALE" ? "OPEN" : "NOT_APPLICABLE";
  const animal = await prisma.animal.create({
    data: { ...parsed.data, breedingState, breedingStateSince: new Date() },
  });
  res.status(201).json(animal);
});

animalsRouter.get("/:id", async (req, res) => {
  const animal = await prisma.animal.findUnique({
    where: { id: req.params.id },
    include: { location: true, dam: true, sire: true },
  });
  if (!animal) return res.status(404).json({ error: "Not found" });
  res.json(animal);
});

/** Merged, chronological timeline of every event recorded against this animal — the single-source-of-truth view for the Animal Profile screen. */
animalsRouter.get("/:id/timeline", async (req, res) => {
  const animal = await prisma.animal.findUnique({ where: { id: req.params.id } });
  if (!animal) return res.status(404).json({ error: "Not found" });

  const [breedingEvents, milkRecords, healthEvents, financialTransactions] = await Promise.all([
    prisma.breedingEvent.findMany({
      where: { animalId: animal.id },
      include: { operator: true, calvingDetail: true },
    }),
    prisma.milkRecord.findMany({ where: { animalId: animal.id } }),
    prisma.healthEvent.findMany({
      where: { animalId: animal.id },
      include: { operator: true, medicine: true, vaccine: true },
    }),
    prisma.financialTransaction.findMany({ where: { animalId: animal.id } }),
  ]);

  const timeline = [
    ...breedingEvents.map((e) => ({
      kind: "breeding" as const,
      date: e.eventDate,
      id: e.id,
      type: e.type,
      result: e.result,
      notes: e.notes,
      operator: e.operator?.name ?? null,
      calvingDetail: e.calvingDetail,
    })),
    ...milkRecords.map((m) => ({
      kind: "milk" as const,
      date: m.recordDate,
      id: m.id,
      session: m.session,
      yieldLiters: m.yieldLiters,
      fatPct: m.fatPct,
      proteinPct: m.proteinPct,
    })),
    ...healthEvents.map((h) => ({
      kind: "health" as const,
      date: h.eventDate,
      id: h.id,
      type: h.type,
      medicine: h.medicine?.name ?? null,
      vaccine: h.vaccine?.name ?? null,
      dosage: h.dosage,
      cost: h.cost,
      notes: h.notes,
      operator: h.operator?.name ?? null,
      withdrawalEndDate: h.withdrawalEndDate,
    })),
    ...financialTransactions.map((f) => ({
      kind: "financial" as const,
      date: f.date,
      id: f.id,
      type: f.type,
      category: f.category,
      amount: f.amount,
      currency: f.currency,
      notes: f.notes,
    })),
  ];

  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());

  const now = new Date();
  const activeWithdrawal = healthEvents
    .filter((h) => h.withdrawalEndDate && h.withdrawalEndDate > now)
    .sort((a, b) => b.withdrawalEndDate!.getTime() - a.withdrawalEndDate!.getTime())[0];

  res.json({
    animal,
    timeline,
    activeWithdrawalUntil: activeWithdrawal?.withdrawalEndDate ?? null,
  });
});

const exitSchema = z.object({
  exitReason: z.enum(["SALE", "DEATH", "SLAUGHTER"]),
  exitDate: z.coerce.date().default(() => new Date()),
});

/** Retires an animal from the herd: terminal breeding state, stops all further alert generation. */
animalsRouter.post("/:id/exit", requirePermission("HERD"), async (req, res) => {
  const parsed = exitSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const animal = await prisma.animal.findUnique({ where: { id: req.params.id } });
  if (!animal) return res.status(404).json({ error: "Not found" });

  const statusMap = { SALE: "SOLD", DEATH: "DEAD", SLAUGHTER: "SLAUGHTERED" } as const;

  await prisma.$transaction(async (tx) => {
    await tx.animal.update({
      where: { id: animal.id },
      data: {
        status: statusMap[parsed.data.exitReason],
        exitDate: parsed.data.exitDate,
        exitReason: parsed.data.exitReason,
        breedingState: "CULLED",
      },
    });
    await tx.alert.updateMany({
      where: { animalId: animal.id, status: "PENDING" },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
  });

  const updated = await prisma.animal.findUnique({ where: { id: animal.id } });
  res.json(updated);
});
