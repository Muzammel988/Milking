import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { applyBreedingEvent, InvalidTransitionError } from "../services/reproductionStateMachine.js";
import { requirePermission } from "../middleware/permissions.js";

export const breedingEventsRouter = Router();

const calvingDetailSchema = z.object({
  calfAnimalId: z.string().optional(),
  calvingType: z.enum(["NORMAL", "ASSISTED", "CAESAREAN"]),
  problems: z.array(z.string()).default([]),
  birthWeightKg: z.number().positive().optional(),
  isTwin: z.boolean().default(false),
});

const createEventSchema = z.object({
  animalId: z.string().min(1),
  type: z.enum([
    "HEAT_OBSERVED",
    "SYNCHRONIZATION_STEP",
    "INSEMINATION",
    "PREGNANCY_CHECK",
    "CALVING",
    "DRY_OFF",
    "ABORTION",
  ]),
  eventDate: z.coerce.date(),
  semenOrSireRef: z.string().optional(),
  semenStrawId: z.string().optional(),
  operatorId: z.string().optional(),
  result: z.enum(["POSITIVE", "NEGATIVE", "INCONCLUSIVE"]).optional(),
  notes: z.string().optional(),
  calvingDetail: calvingDetailSchema.optional(),
});

breedingEventsRouter.get("/", async (req, res) => {
  const animalId = req.query.animalId as string | undefined;
  const events = await prisma.breedingEvent.findMany({
    where: animalId ? { animalId } : undefined,
    include: { calvingDetail: true },
    orderBy: { eventDate: "desc" },
  });
  res.json(events);
});

breedingEventsRouter.post("/", requirePermission("BREEDING"), async (req, res) => {
  const parsed = createEventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  if (input.type === "CALVING" && !input.calvingDetail) {
    return res.status(400).json({ error: "calvingDetail is required for CALVING events" });
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const animal = await tx.animal.findUnique({ where: { id: input.animalId } });
      if (!animal) throw new Error("ANIMAL_NOT_FOUND");

      const params = await tx.systemParameters.findUnique({ where: { farmId: animal.farmId } });
      if (!params) throw new Error("SYSTEM_PARAMETERS_NOT_FOUND");

      const event = await tx.breedingEvent.create({
        data: {
          animalId: input.animalId,
          type: input.type,
          eventDate: input.eventDate,
          semenOrSireRef: input.semenOrSireRef,
          semenStrawId: input.semenStrawId,
          operatorId: input.operatorId,
          result: input.result,
          notes: input.notes,
          ...(input.calvingDetail
            ? {
                calvingDetail: {
                  create: input.calvingDetail,
                },
              }
            : {}),
        },
        include: { calvingDetail: true },
      });

      if (input.type === "INSEMINATION" && input.semenStrawId) {
        await tx.semenStraw.update({
          where: { id: input.semenStrawId },
          data: { quantityOnHand: { decrement: 1 } },
        });
      }

      await applyBreedingEvent(tx, animal, params, {
        animalId: input.animalId,
        type: input.type,
        eventDate: input.eventDate,
        result: input.result,
        operatorId: input.operatorId,
      });

      return event;
    });

    res.status(201).json(created);
  } catch (err) {
    if (err instanceof InvalidTransitionError) {
      return res.status(409).json({ error: err.message });
    }
    if (err instanceof Error && err.message === "ANIMAL_NOT_FOUND") {
      return res.status(404).json({ error: "Animal not found" });
    }
    if (err instanceof Error && err.message === "SYSTEM_PARAMETERS_NOT_FOUND") {
      return res.status(500).json({ error: "Farm is missing system parameters" });
    }
    throw err;
  }
});
