import { Hono } from "hono";
import { getDb, dbUrlFromHeader } from "../db";
import { trackedEmails } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { emailDbMap } from "./track";

const router = new Hono();

// POST /api/emails — register a new tracked email
router.post("/", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const body = await c.req.json<{
    id?: string;
    recipient: string;
    subject?: string;
    status?: string;
  }>();

  if (!body.recipient) {
    return c.json({ error: "recipient is required" }, 400);
  }

  const values: typeof trackedEmails.$inferInsert = {
    recipient: body.recipient,
    subject: body.subject,
    status: body.status ?? "sent",
  };
  if (body.id) values.id = body.id;

  const [email] = await db.insert(trackedEmails).values(values).returning();

  // Register in the pixel map so the tracking pixel knows which DB to update
  const dbUrl = dbUrlFromHeader(c.req.header("x-database-url"));
  if (dbUrl && email.id) {
    emailDbMap.set(email.id, dbUrl);
  }

  return c.json(email, 201);
});

// GET /api/emails — list all tracked emails
router.get("/", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const emails = await db
    .select()
    .from(trackedEmails)
    .orderBy(sql`${trackedEmails.sentAt} desc`);
  return c.json(emails);
});

// GET /api/emails/:id — get a single tracked email
router.get("/:id", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const [email] = await db
    .select()
    .from(trackedEmails)
    .where(eq(trackedEmails.id, c.req.param("id")));

  if (!email) return c.json({ error: "Not found" }, 404);
  return c.json(email);
});

// PATCH /api/emails/:id/status — manually update status
router.patch("/:id/status", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const body = await c.req.json<{ status: string }>();

  const [updated] = await db
    .update(trackedEmails)
    .set({ status: body.status })
    .where(eq(trackedEmails.id, c.req.param("id")))
    .returning();

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json(updated);
});

export default router;
