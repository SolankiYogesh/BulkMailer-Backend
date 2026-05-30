import { Hono } from "hono";
import { neon } from "@neondatabase/serverless";

const router = new Hono();

// POST /api/db/connect
// Body: { databaseUrl: string }
// Runs the full schema migration against the provided DB URL.
// Returns { success: true } or { error: string }
router.post("/connect", async (c) => {
  const body = await c.req.json<{ databaseUrl: string }>();

  if (!body.databaseUrl || !body.databaseUrl.startsWith("postgres")) {
    return c.json({ error: "A valid PostgreSQL connection URL is required." }, 400);
  }

  try {
    const sql = neon(body.databaseUrl);

    // Create table if it doesn't exist — idempotent, safe to re-run
    await sql`
      CREATE TABLE IF NOT EXISTS tracked_emails (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient    TEXT NOT NULL,
        subject      TEXT,
        status       TEXT NOT NULL DEFAULT 'sent',
        sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        read_at      TIMESTAMPTZ,
        read_count   INT NOT NULL DEFAULT 0,
        user_agent   TEXT,
        ip_address   TEXT
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tracked_emails_status
        ON tracked_emails(status)
    `;

    // Quick sanity check — list tables
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'tracked_emails'
    `;

    return c.json({
      success: true,
      tables: (tables as Array<Record<string, unknown>>).map((r) => r["table_name"] as string),
      message: "Database connected and schema is ready.",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Migration failed: ${message}` }, 500);
  }
});

// POST /api/db/verify
// Lightweight check — just pings the DB with the provided URL
router.post("/verify", async (c) => {
  const body = await c.req.json<{ databaseUrl: string }>();

  if (!body.databaseUrl) {
    return c.json({ error: "databaseUrl is required." }, 400);
  }

  try {
    const sql = neon(body.databaseUrl);
    await sql`SELECT 1`;
    return c.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

export default router;
