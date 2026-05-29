import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import campaignsRouter from "./routes/campaigns";
import emailsRouter from "./routes/emails";
import trackRouter from "./routes/track";
import dbRouter from "./routes/db";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

app.get("/api/config", (c) => {
  return c.json({
    backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    version: "1.0.0",
  });
});

app.route("/api/campaigns", campaignsRouter);
app.route("/api/emails", emailsRouter);
app.route("/track", trackRouter);
app.route("/api/db", dbRouter);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
