import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Returns a Drizzle client for the given database URL.
 * The URL comes from the X-Database-URL request header sent by the Swift app.
 * Falls back to DATABASE_URL env var for local dev / Railway deploy.
 */
export function getDb(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "No database URL provided. Set DATABASE_URL env var or pass X-Database-URL header."
    );
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

/** Helper — extracts DB URL from Hono context header */
export function dbUrlFromHeader(header: string | undefined): string | undefined {
  return header ?? process.env.DATABASE_URL;
}
