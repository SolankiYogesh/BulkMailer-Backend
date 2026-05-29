import { Hono } from "hono";
import { getDb, dbUrlFromHeader } from "../db";
import { campaigns, trackedEmails } from "../db/schema";
import { eq, sql } from "drizzle-orm";

const router = new Hono();

// POST /api/campaigns
router.post("/", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const body = await c.req.json<{
    subject: string;
    body: string;
    sender: string;
    totalCount: number;
  }>();

  if (!body.subject || !body.sender) {
    return c.json({ error: "subject and sender are required" }, 400);
  }

  const [campaign] = await db
    .insert(campaigns)
    .values({
      subject: body.subject,
      body: body.body ?? "",
      sender: body.sender,
      totalCount: body.totalCount ?? 0,
    })
    .returning();

  return c.json(campaign, 201);
});

// GET /api/campaigns
router.get("/", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));

  const rows = await db
    .select({
      id: campaigns.id,
      subject: campaigns.subject,
      sender: campaigns.sender,
      createdAt: campaigns.createdAt,
      totalCount: campaigns.totalCount,
      readCount:   sql<number>`cast(count(case when ${trackedEmails.status} = 'read'   then 1 end) as int)`,
      sentCount:   sql<number>`cast(count(case when ${trackedEmails.status} = 'sent'   then 1 end) as int)`,
      failedCount: sql<number>`cast(count(case when ${trackedEmails.status} = 'failed' then 1 end) as int)`,
    })
    .from(campaigns)
    .leftJoin(trackedEmails, eq(campaigns.id, trackedEmails.campaignId))
    .groupBy(campaigns.id)
    .orderBy(sql`${campaigns.createdAt} desc`);

  return c.json(rows);
});

// GET /api/campaigns/:id
router.get("/:id", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  const id = c.req.param("id");

  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id));

  if (!campaign) return c.json({ error: "Campaign not found" }, 404);

  const emails = await db
    .select()
    .from(trackedEmails)
    .where(eq(trackedEmails.campaignId, id))
    .orderBy(trackedEmails.sentAt);

  const readCount   = emails.filter((e) => e.status === "read").length;
  const sentCount   = emails.filter((e) => e.status === "sent").length;
  const failedCount = emails.filter((e) => e.status === "failed").length;

  return c.json({ ...campaign, emails, stats: { readCount, sentCount, failedCount } });
});

// DELETE /api/campaigns/:id
router.delete("/:id", async (c) => {
  const db = getDb(dbUrlFromHeader(c.req.header("x-database-url")));
  await db.delete(campaigns).where(eq(campaigns.id, c.req.param("id")));
  return c.json({ success: true });
});

export default router;
