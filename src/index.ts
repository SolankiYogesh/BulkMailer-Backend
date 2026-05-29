import { serve } from "@hono/node-server";
import * as dotenv from "dotenv";

import app from "./app";

dotenv.config();

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, () => {
  console.log(`BulkMailer tracking server running on http://localhost:${port}`);
});
