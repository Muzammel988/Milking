import { Router } from "express";
import { prisma } from "../db.js";
import { runReproductionJob } from "../jobs/reproductionJob.js";

export const jobsRouter = Router();

/** Manual trigger for the nightly reproduction state-machine evaluation (also runnable via `npm run job:reproduction`). */
jobsRouter.post("/reproduction", async (req, res) => {
  const now = req.body?.now ? new Date(req.body.now) : new Date();
  const result = await runReproductionJob(prisma, now);
  res.json(result);
});
