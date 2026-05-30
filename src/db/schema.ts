import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

export const trackedEmails = pgTable("tracked_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  recipient: text("recipient").notNull(),
  subject: text("subject"),
  status: text("status").notNull().default("sent"), // 'sent' | 'read' | 'failed'
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  readCount: integer("read_count").notNull().default(0),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export type TrackedEmail = typeof trackedEmails.$inferSelect;
export type NewTrackedEmail = typeof trackedEmails.$inferInsert;
