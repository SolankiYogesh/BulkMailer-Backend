# BulkMailer Tracking Backend

Email open-tracking server for [BulkMailer](https://github.com/SolankiYogesh/BulkMailer).

Built with **Hono** · **Drizzle ORM** · **Neon PostgreSQL** · **TypeScript**

---

## What this does

This server powers email open tracking for the BulkMailer macOS app.

- Stores campaign and per-recipient tracking records in **the user's own database**
- Serves a **1×1 invisible tracking pixel** — when a recipient opens an email, their client loads the pixel, marking the email as read
- Exposes a REST API the Mac app polls every 30 seconds for live status updates
- Runs schema migrations on-demand when a user connects their database

**Privacy model:** This server is stateless with respect to user data. Each request from the Mac app includes an `X-Database-URL` header with the user's own PostgreSQL connection string. No user data is stored on this server.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | [Hono](https://hono.dev) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Database driver | [@neondatabase/serverless](https://github.com/neondatabase/serverless) |
| Language | TypeScript (strict) |
| Deploy | [Railway](https://railway.app) |

---

## Quick Start (Local)

```sh
git clone https://github.com/SolankiYogesh/bulkmailer-tracking-backend
cd bulkmailer-tracking-backend

cp .env.example .env
# Edit .env — add DATABASE_URL (optional for local dev)

npm install
npm run dev
```

Server starts at `http://localhost:3000`.

Test it:
```sh
curl http://localhost:3000/health
# → {"status":"ok","ts":"..."}
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Optional | Fallback Postgres URL for local dev. Users supply their own via the app. |
| `BACKEND_URL` | Recommended | The public URL of this deployed server. Shown in the Mac app Settings. |
| `PORT` | Optional | Port to listen on. Default: `3000`. |

```env
# .env.example
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
BACKEND_URL=https://your-app.up.railway.app
PORT=3000
```

---

## Deploy to Railway

### One-click from GitHub

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
3. Select this repository (root directory is already the backend)
4. Add environment variables in Railway dashboard:
   - `BACKEND_URL` = `https://your-app.up.railway.app` *(fill after first deploy)*
5. Deploy — Railway uses `railway.toml` automatically
6. Copy your Railway URL, update `BACKEND_URL`, redeploy

### Railway CLI

```sh
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set BACKEND_URL=https://your-app.up.railway.app
```

### Verify deploy

```sh
curl https://your-app.up.railway.app/health
# → {"status":"ok","ts":"..."}

curl https://your-app.up.railway.app/api/config
# → {"backendUrl":"https://your-app.up.railway.app","version":"1.0.0"}
```

---

## After Deploying

Update the hardcoded backend URL in the Mac app:

```swift
// BulkMailer-Swift/Sources/TrackingAPIClient.swift
static let backendURL = "https://your-app.up.railway.app"
```

Then rebuild the Mac app:
```sh
./build.sh
```

---

## API Reference

### Health & Config

```
GET /health
→ { status: "ok", ts: "2026-05-29T..." }

GET /api/config
→ { backendUrl: "https://...", version: "1.0.0" }
```

### Database Setup

```
POST /api/db/connect
Content-Type: application/json
Body: { "databaseUrl": "postgresql://..." }

→ 200 { success: true, tables: ["campaigns", "tracked_emails"], message: "..." }
→ 400 { error: "A valid PostgreSQL connection URL is required." }
→ 500 { error: "Migration failed: ..." }
```

Runs `CREATE TABLE IF NOT EXISTS` for all schema tables. Safe to call multiple times.

```
POST /api/db/verify
Body: { "databaseUrl": "postgresql://..." }
→ { success: true }
```

### Campaigns

All campaign endpoints require the `X-Database-URL` header.

```
GET /api/campaigns
X-Database-URL: postgresql://...

→ [
    {
      "id": "uuid",
      "subject": "Software Engineer @ Acme",
      "sender": "me@gmail.com",
      "createdAt": "2026-05-29T10:00:00Z",
      "totalCount": 10,
      "readCount": 4,
      "sentCount": 5,
      "failedCount": 1
    },
    ...
  ]
```

```
POST /api/campaigns
X-Database-URL: postgresql://...
Body: { "subject": "...", "body": "...", "sender": "...", "totalCount": 10 }
→ 201 { id, subject, body, sender, createdAt, totalCount }
```

```
GET /api/campaigns/:id
X-Database-URL: postgresql://...
→ {
    ...campaign,
    emails: [ { id, recipient, status, sentAt, readAt, readCount, ... } ],
    stats: { readCount, sentCount, failedCount }
  }
```

```
DELETE /api/campaigns/:id
X-Database-URL: postgresql://...
→ { success: true }
```

### Emails

All email endpoints require the `X-Database-URL` header.

```
POST /api/emails
X-Database-URL: postgresql://...
Body: { "id": "uuid", "campaignId": "uuid", "recipient": "alice@example.com" }
→ 201 { id, campaignId, recipient, status, sentAt, readCount }
```

Supplying a pre-generated `id` lets the Mac app embed the tracking pixel URL before the email is sent.

```
GET /api/emails/:id
X-Database-URL: postgresql://...
→ { id, campaignId, recipient, status, sentAt, readAt, readCount, userAgent, ipAddress }
```

```
PATCH /api/emails/:id/status
X-Database-URL: postgresql://...
Body: { "status": "failed" }
→ { ...updatedEmail }
```

### Tracking Pixel

```
GET /track/:emailId/pixel.gif
```

Returns a 1×1 transparent GIF (`image/gif`, `Cache-Control: no-store`).

When an email client loads this URL:
1. Server looks up the DB URL for this `emailId` (from in-memory map populated at registration)
2. Updates: `status = 'read'`, `read_at = now()`, `read_count += 1`
3. Records `user_agent` and `ip_address` from request headers
4. Returns the pixel immediately — DB update is fire-and-forget

No `X-Database-URL` header needed on this endpoint.

---

## Database Schema

```sql
CREATE TABLE campaigns (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  sender      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_count INT NOT NULL DEFAULT 0
);

CREATE TABLE tracked_emails (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient    TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'sent',  -- 'sent' | 'read' | 'failed'
  sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at      TIMESTAMPTZ,
  read_count   INT NOT NULL DEFAULT 0,
  user_agent   TEXT,
  ip_address   TEXT
);

CREATE INDEX idx_tracked_emails_campaign ON tracked_emails(campaign_id);
CREATE INDEX idx_tracked_emails_status   ON tracked_emails(status);
```

Tables are created automatically via `POST /api/db/connect`. No manual migration needed.

---

## Project Structure

```
.
├── src/
│   ├── index.ts          Server entry point, middleware, route registration
│   ├── db/
│   │   ├── schema.ts     Drizzle table definitions + TypeScript types
│   │   ├── index.ts      Per-request DB factory: getDb(url), dbUrlFromHeader()
│   │   └── migrate.ts    Optional standalone migration runner
│   └── routes/
│       ├── campaigns.ts  Campaign CRUD + aggregated stats
│       ├── emails.ts     Email registration, status updates, pixel map population
│       ├── track.ts      Tracking pixel endpoint + in-memory emailDbMap
│       └── db.ts         /api/db/connect and /api/db/verify
├── .env.example          Environment variable template
├── .gitignore
├── drizzle.config.ts     Drizzle Kit config (for drizzle-kit studio)
├── package.json
├── railway.toml          Railway deploy config
├── README.md
└── tsconfig.json
```

---

## Scripts

```sh
npm run dev          # Start with tsx watch (hot reload)
npm run build        # Compile TypeScript → dist/
npm start            # Run compiled output (used in production)
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Run pending migrations
npm run db:studio    # Open Drizzle Studio (visual DB browser)
```

---

## Free Hosting Options

| Platform | Notes |
|---|---|
| **Railway** ✅ | $5/month free credit, no cold starts — recommended |
| **Render** | Free tier sleeps after 15min idle — causes ~30s pixel load delay |
| **Fly.io** | 3 free shared VMs, more setup required |

For reliable tracking pixels, use Railway or Fly.io (no cold starts on free tier).

## Free Database Options (for users)

| Provider | Free Tier | Notes |
|---|---|---|
| **Neon** ✅ | 0.5 GB, 190 compute hrs/month | Recommended |
| **Supabase** | 500 MB, 2 projects | Use the direct connection string |
| **Aiven** | 5 GB | 30-day trial only |

---

## Contributing

1. Fork and clone
2. `cp .env.example .env` and add a test database URL
3. `npm install && npm run dev`
4. Make changes — run `npx tsc --noEmit` to type-check
5. Open a PR

---

## Related

- [BulkMailer](https://github.com/SolankiYogesh/BulkMailer) — the macOS app that uses this backend

---

## License

MIT
