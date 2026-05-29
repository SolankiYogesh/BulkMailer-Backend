# Contributing to BulkMailer Tracking Backend

## Setup

```sh
git clone https://github.com/your-username/bulkmailer-tracking-backend
cd bulkmailer-tracking-backend
cp .env.example .env
# Add a test DATABASE_URL (free Neon DB works fine)
npm install
npm run dev
```

## Code Style

- **TypeScript strict mode** — no `any`, no implicit returns
- One router file per resource in `src/routes/`
- Per-request DB instances via `getDb(url)` — never a shared singleton
- All routes return structured JSON with consistent error shapes: `{ error: "..." }`
- Fire-and-forget DB updates in the pixel endpoint — never block the response

## Key Design Decisions

**Why per-request DB connections?**
Each user supplies their own database URL. There's no single shared DB — every request routes to a different Postgres instance based on the `X-Database-URL` header.

**Why an in-memory map for the pixel endpoint?**
Email clients load the tracking pixel without any custom headers. The `emailDbMap` in `track.ts` is populated when an email is registered (`POST /api/emails`), so the pixel endpoint knows which DB to update without needing a header.

**Why no Drizzle migrations folder committed?**
Schema is applied via `POST /api/db/connect` using raw `CREATE TABLE IF NOT EXISTS` SQL — idempotent and works against any user's DB without a migration history. The `drizzle/` folder is gitignored.

## Adding a New Column

1. Add the column to `src/db/schema.ts`
2. Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` to the connect endpoint in `src/routes/db.ts` so existing users get the column on next connect
3. Update any affected route handlers
4. Update the TypeScript types if needed

## Testing Locally

```sh
# Start the server
npm run dev

# Create a campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -H "X-Database-URL: postgresql://..." \
  -d '{"subject":"Test","body":"Hello","sender":"me@gmail.com","totalCount":1}'

# Register an email
curl -X POST http://localhost:3000/api/emails \
  -H "Content-Type: application/json" \
  -H "X-Database-URL: postgresql://..." \
  -d '{"id":"test-uuid","campaignId":"<campaign-id>","recipient":"test@example.com"}'

# Simulate a pixel load (marks as read)
curl http://localhost:3000/track/test-uuid/pixel.gif

# Check status
curl http://localhost:3000/api/campaigns/<campaign-id> \
  -H "X-Database-URL: postgresql://..."
```

## Pull Requests

- Run `npx tsc --noEmit` — must pass with zero errors
- Keep PRs focused — one feature or fix per PR
- Update `README.md` if you add or change an API endpoint
