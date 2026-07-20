import { Router } from "express";
import { prisma } from "../db.js";
import { runReproductionJob } from "../jobs/reproductionJob.js";
import { runLactationJob } from "../jobs/lactationJob.js";

export const jobsRouter = Router();

/** Manual trigger for the nightly reproduction state-machine evaluation (also runnable via `npm run job:reproduction`). */
jobsRouter.post("/reproduction", async (req, res) => {
  const now = req.body?.now ? new Date(req.body.now) : new Date();
  const result = await runReproductionJob(prisma, now);
  res.json(result);
});

/** Manual trigger for the nightly lactation state-machine evaluation (also runnable via `npm run job:lactation`). */
jobsRouter.post("/lactation", async (req, res) => {
  const now = req.body?.now ? new Date(req.body.now) : new Date();
  const result = await runLactationJob(prisma, now);
  res.json(result);
});

/** Convenience: runs both nightly jobs in sequence (what a real cron would do). */
jobsRouter.post("/run-all", async (req, res) => {
  const now = req.body?.now ? new Date(req.body.now) : new Date();
  const reproduction = await runReproductionJob(prisma, now);
  const lactation = await runLactationJob(prisma, now);
  res.json({ reproduction, lactation });
});
