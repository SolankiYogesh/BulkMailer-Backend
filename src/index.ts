import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import * as dotenv from "dotenv";

import campaignsRouter from "./routes/campaigns";
import emailsRouter from "./routes/emails";
import trackRouter from "./routes/track";
import dbRouter from "./routes/db";

dotenv.config();

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

// Public config — lets the Swift app discover the backend URL at runtime
// The app ships with BACKEND_URL baked in, but this also confirms the server is reachable
app.get("/api/config", (c) => {
  return c.json({
    backendUrl: process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,
    version: "1.0.0",
  });
});

// Routes
app.route("/api/campaigns", campaignsRouter);
app.route("/api/emails", emailsRouter);
app.route("/track", trackRouter);
app.route("/api/db", dbRouter);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`🚀 BulkMailer tracking server running on http://localhost:${port}`);
});

export default app;
