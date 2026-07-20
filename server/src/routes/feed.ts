import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { ensurePendingAlert } from "../services/alertService.js";
import { requirePermission } from "../middleware/permissions.js";

export const feedIngredientsRouter = Router();
export const rationFormulasRouter = Router();
export const feedConsumptionRouter = Router();

const LOW_STOCK_THRESHOLD_DAYS = 3; // heuristic: warn when stock covers less than N days of current consumption rate

const ingredientSchema = z.object({
  farmId: z.string().min(1),
  name: z.string().min(1),
  unitOfMeasure: z.string().min(1),
  costPerUnit: z.number().nonnegative(),
  stockQuantity: z.number().nonnegative().default(0),
});

feedIngredientsRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  res.json(await prisma.feedIngredient.findMany({ where: farmId ? { farmId } : undefined, orderBy: { name: "asc" } }));
});

feedIngredientsRouter.post("/", requirePermission("FEED"), async (req, res) => {
  const parsed = ingredientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  res.status(201).json(await prisma.feedIngredient.create({ data: parsed.data }));
});

const restockSchema = z.object({ quantity: z.number().positive() });
feedIngredientsRouter.post("/:id/restock", requirePermission("FEED"), async (req, res) => {
  const parsed = restockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ingredient = await prisma.feedIngredient.update({
    where: { id: req.params.id },
    data: { stockQuantity: { increment: parsed.data.quantity } },
  });
  res.json(ingredient);
});

const rationSchema = z.object({
  farmId: z.string().min(1),
  name: z.string().min(1),
  targetGroup: z.enum(["LACTATING", "DRY", "HEIFER", "CALF"]),
  ingredients: z
    .array(z.object({ feedIngredientId: z.string().min(1), quantityPerHeadPerDay: z.number().positive() }))
    .min(1),
});

rationFormulasRouter.get("/", async (req, res) => {
  const farmId = req.query.farmId as string | undefined;
  const formulas = await prisma.rationFormula.findMany({
    where: farmId ? { farmId } : undefined,
    include: { ingredients: { include: { feedIngredient: true } } },
    orderBy: { name: "asc" },
  });
  res.json(
    formulas.map((f) => ({
      ...f,
      costPerHeadPerDay: f.ingredients.reduce((sum, i) => sum + i.quantityPerHeadPerDay * i.feedIngredient.costPerUnit, 0),
    }))
  );
});

rationFormulasRouter.post("/", requirePermission("FEED"), async (req, res) => {
  const parsed = rationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { ingredients, ...rest } = parsed.data;
  const formula = await prisma.rationFormula.create({
    data: { ...rest, ingredients: { create: ingredients } },
    include: { ingredients: { include: { feedIngredient: true } } },
  });
  res.status(201).json(formula);
});

const consumptionSchema = z
  .object({
    farmId: z.string().min(1),
    rationFormulaId: z.string().min(1),
    animalId: z.string().optional(),
    groupLabel: z.string().optional(),
    headCount: z.number().int().positive().default(1),
    date: z.coerce.date(),
  })
  .refine((v) => v.animalId || v.groupLabel, { message: "Either animalId or groupLabel is required" });

feedConsumptionRouter.get("/", async (req, res) => {
  const { farmId, animalId } = req.query as Record<string, string | undefined>;
  res.json(
    await prisma.feedConsumptionRecord.findMany({
      where: { farmId, animalId },
      include: { rationFormula: true },
      orderBy: { date: "desc" },
    })
  );
});

feedConsumptionRouter.post("/", requirePermission("FEED"), async (req, res) => {
  const parsed = consumptionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const input = parsed.data;

  const formula = await prisma.rationFormula.findUnique({
    where: { id: input.rationFormulaId },
    include: { ingredients: { include: { feedIngredient: true } } },
  });
  if (!formula) return res.status(404).json({ error: "Ration formula not found" });

  const record = await prisma.$transaction(async (tx) => {
    let totalCost = 0;
    const lowStock: string[] = [];
    for (const line of formula.ingredients) {
      const quantityUsed = line.quantityPerHeadPerDay * input.headCount;
      totalCost += quantityUsed * line.feedIngredient.costPerUnit;
      const updated = await tx.feedIngredient.update({
        where: { id: line.feedIngredientId },
        data: { stockQuantity: { decrement: quantityUsed } },
      });

      if (quantityUsed > 0 && updated.stockQuantity / quantityUsed < LOW_STOCK_THRESHOLD_DAYS) {
        lowStock.push(`${updated.name} (${updated.stockQuantity.toFixed(1)} ${updated.unitOfMeasure} left)`);
      }
    }

    // Farm-wide alerts (animalId null) dedupe per type, so low-stock ingredients
    // are bundled into a single alert rather than clobbering each other.
    if (lowStock.length > 0) {
      await ensurePendingAlert(tx, {
        animalId: null,
        type: "LOW_FEED_STOCK",
        urgency: "HIGH",
        dueDate: new Date(),
        message: `Low stock (under ${LOW_STOCK_THRESHOLD_DAYS} days at current usage): ${lowStock.join(", ")}`,
      });
    }

    const created = await tx.feedConsumptionRecord.create({
      data: {
        farmId: input.farmId,
        rationFormulaId: input.rationFormulaId,
        animalId: input.animalId,
        groupLabel: input.groupLabel,
        headCount: input.headCount,
        date: input.date,
        totalCost,
      },
    });

    await tx.financialTransaction.create({
      data: {
        farmId: input.farmId,
        date: input.date,
        type: "EXPENSE",
        category: "FEED_PURCHASE",
        amount: totalCost,
        animalId: input.animalId,
        animalGroupLabel: input.groupLabel,
        notes: `Feed consumption — ${formula.name}`,
      },
    });

    return created;
  });

  res.status(201).json(record);
});
