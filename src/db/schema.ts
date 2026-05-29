import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sender: text("sender").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  totalCount: integer("total_count").notNull().default(0),
});

export const trackedEmails = pgTable("tracked_emails", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  recipient: text("recipient").notNull(),
  status: text("status").notNull().default("sent"), // 'sent' | 'read' | 'failed'
  sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
  readCount: integer("read_count").notNull().default(0),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
});

export type Campaign = typeof campaigns.$inferSelect;
export type NewCampaign = typeof campaigns.$inferInsert;
export type TrackedEmail = typeof trackedEmails.$inferSelect;
export type NewTrackedEmail = typeof trackedEmails.$inferInsert;
