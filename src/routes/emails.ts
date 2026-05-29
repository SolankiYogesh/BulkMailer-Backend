import { Hono } from "hono";
import { getDb, dbUrlFromHeader } from "../db";
import { trackedEmails } from "../db/schema";
import { eq } from "drizzle-orm";
import { emailDbMap } from "./track";

const router = new Hono();

// POST /api/emails
router.post("/", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const body = await c.req.json<{
    id?: string;
    campaignId: string;
    recipient: string;
    status?: string;
  }>();

  if (!body.campaignId || !body.recipient) {
    return c.json({ error: "campaignId and recipient are required" }, 400);
  }

  const values: typeof trackedEmails.$inferInsert = {
    campaignId: body.campaignId,
    recipient: body.recipient,
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

// GET /api/emails/:id
router.get("/:id", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const [email] = await db
    .select()
    .from(trackedEmails)
    .where(eq(trackedEmails.id, c.req.param("id")));

  if (!email) return c.json({ error: "Not found" }, 404);
  return c.json(email);
});

// PATCH /api/emails/:id/status
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
