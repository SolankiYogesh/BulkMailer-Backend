import { Hono } from "hono";
import { getDb } from "../db";
import { trackedEmails } from "../db/schema";
import { eq, sql } from "drizzle-orm";

const router = new Hono();

// In-memory map: emailId → databaseUrl
// Populated by POST /api/emails when X-Database-URL header is present.
// This lets the pixel endpoint know which DB to update without any header
// (email clients don't send custom headers when loading images).
export const emailDbMap = new Map<string, string>();

// 1×1 transparent GIF
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// GET /track/:emailId/pixel.gif
router.get("/:emailId/pixel.gif", async (c) => {
  const emailId  = c.req.param("emailId");
  const userAgent = c.req.header("user-agent") ?? null;
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0].trim() ??
    c.req.header("cf-connecting-ip") ??
    null;

  // Look up which DB this email belongs to
  const dbUrl = emailDbMap.get(emailId) ?? process.env.DATABASE_URL;

  if (dbUrl) {
    try {
      const db = getDb(dbUrl);
      await db
        .update(trackedEmails)
        .set({
          status:    "read",
          readAt:    sql`now()`,
          readCount: sql`${trackedEmails.readCount} + 1`,
          userAgent,
          ipAddress: ip,
        })
        .where(eq(trackedEmails.id, emailId))
        .execute();
    } catch {
      // Never fail a pixel request
    }
  }

  return new Response(PIXEL_GIF, {
    status: 200,
    headers: {
      "Content-Type":  "image/gif",
      "Content-Length": String(PIXEL_GIF.length),
      "Cache-Control":  "no-store, no-cache, must-revalidate, private",
      "Pragma":         "no-cache",
      "Expires":        "0",
    },
  });
});

export default router;
