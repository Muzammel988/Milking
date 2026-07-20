import { prisma } from "../db.js";
import { runLactationJob } from "./lactationJob.js";

runLactationJob(prisma)
  .then((result) => {
    console.log("Lactation job complete:", result);
  })
  .finally(() => prisma.$disconnect());
