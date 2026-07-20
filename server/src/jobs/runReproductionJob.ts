import { prisma } from "../db.js";
import { runReproductionJob } from "./reproductionJob.js";

runReproductionJob(prisma)
  .then((result) => {
    console.log("Reproduction job complete:", result);
  })
  .finally(() => prisma.$disconnect());
