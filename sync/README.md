# Sync service

Lets two or more phones share one travel day checklist with no sign-up. It runs on Cloudflare's free Workers plan.

- One Durable Object `Room` per shared trailer, named by its 6-character code (no 0/O, 1/I/L).
- Phones connect with a WebSocket, send their changes, and get the whole list back. The last change to arrive wins, item by item. Each phone keeps its own copy and works offline.
- A `Limiter` object per IP address caps new codes (10 an hour) and wrong codes (20 an hour), in memory only.
- Stored per trailer: the list (trip number and name, checked, hidden and custom items). No names, emails or locations. Lists untouched for a year are deleted.
- Only sites in `ALLOWED_ORIGINS` (`wrangler.jsonc`) can use it.

## Run it locally

```
npm install
npm run dev     # http://localhost:8787, allows http://localhost:8000
npm test        # unit tests; also two-phone tests when the dev server is running
```

## Deploy

`.github/workflows/deploy-sync.yml` deploys on every push to `main` that touches `sync/`, once the repository has the secrets `CLOUDFLARE_API_TOKEN` (made from Cloudflare's "Edit Cloudflare Workers" token template) and `CLOUDFLARE_ACCOUNT_ID`. The service then lives at `https://checklist-sync.<your-subdomain>.workers.dev`; put that address in `SYNC_URL` in `src/app.html` and rebuild to turn sharing on in the app.

## Free plan headroom

Each saved change is one SQLite row write; the free plan allows 100,000 a day. Phones bundle taps made close together into one message, so a shared travel day costs roughly 30 to 100 writes, which is about 1,000 to 3,000 shared travel days a day. Past that, the $5/month Workers Paid plan includes 50 million writes a month.
