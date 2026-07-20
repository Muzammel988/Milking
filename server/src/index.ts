import express from "express";
import cors from "cors";
import { farmsRouter } from "./routes/farms.js";
import { locationsRouter } from "./routes/locations.js";
import { usersRouter } from "./routes/users.js";
import { animalsRouter } from "./routes/animals.js";
import { breedingEventsRouter } from "./routes/breedingEvents.js";
import { alertsRouter } from "./routes/alerts.js";
import { jobsRouter } from "./routes/jobs.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api/farms", farmsRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/users", usersRouter);
app.use("/api/animals", animalsRouter);
app.use("/api/breeding-events", breedingEventsRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/jobs", jobsRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`milking-server listening on :${port}`);
});
