import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requirePermission } from "../middleware/permissions.js";

export const financialTransactionsRouter = Router();

const createSchema = z.object({
  farmId: z.string().min(1),
  date: z.coerce.date(),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum([
    "MILK_SALE",
    "FEED_PURCHASE",
    "VET_COST",
    "INSEMINATION_COST",
    "ANIMAL_PURCHASE",
    "ANIMAL_SALE",
    "LABOR",
    "OTHER",
  ]),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  animalId: z.string().optional(),
  animalGroupLabel: z.string().optional(),
  notes: z.string().optional(),
});

financialTransactionsRouter.get("/", async (req, res) => {
  const { farmId, animalId, category, from, to } = req.query as Record<string, string | undefined>;
  const transactions = await prisma.financialTransaction.findMany({
    where: {
      farmId,
      animalId,
      category: category as never,
      date: from || to ? { gte: from ? new Date(from) : undefined, lte: to ? new Date(to) : undefined } : undefined,
    },
    orderBy: { date: "desc" },
  });
  res.json(transactions);
});

financialTransactionsRouter.post("/", requirePermission("FINANCIAL"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const transaction = await prisma.financialTransaction.create({ data: parsed.data });
  res.status(201).json(transaction);
});
