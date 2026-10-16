# Trip planner (beta)

Hosted version of the RigKit AI trip planner. Lives at `https://rigkit-planner.rigkit31.workers.dev`, separate from the checklist's sharing service.

1. **Order page** (`/`): a tester with the access code fills in their rig and stops. `src/order.js` turns the form into the same order JSON the hand-run beta used.
2. **Agent**: an `Order` Durable Object starts a Claude Managed Agents session. "RigKit Trip Planner" (Opus) runs `agent/discover.py` (Google Places + Routes), hands park websites to "RigKit Park Reader" (Haiku, `agent/getpage.py`, honors robots.txt) and writes `plan.json`. Their instructions are `agent/planner-system.md` and `agent/reader-system.md`.
3. **Keys**: the Google key sits in an Anthropic vault; the agent's container only sees a placeholder that Anthropic swaps for the real key on requests to Google. The Worker holds both keys as Cloudflare secrets. Browsers never see either.
4. **Plan page** (`/p/<id>`): the Order checks the session every 2 minutes and keeps `plan.json` (place IDs and park-website facts only). Ratings, reviews and photos are fetched from Google live on every view and credited (`src/render.js`, `src/google.js`). Photo links are signed so nobody can use the service to spend the Google allowance.
5. **Email** (optional): with a `RESEND_API_KEY` secret, the tester gets their plan link by email.

Limits: each plan has a hard spending cap for Claude and run time (`SESSION_BUDGET_CENTS`, $6), 10 plans a day in total and 5 an hour per IP (`wrangler.jsonc`). Nothing contacts parks.

## Deploy

`.github/workflows/deploy-planner.yml` runs on pushes that touch `planner/`. It runs the tests, then `setup/setup.mjs` (creates or updates the Anthropic environment, vault, script files and both agents, and writes their IDs to `src/setup-ids.js`), then deploys the Worker and sets its secrets. Repository secrets it needs: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `ANTHROPIC_API_KEY`, `GOOGLE_PLACES_API_KEY`, `PLANNER_ACCESS_CODE`, optionally `RESEND_API_KEY`.

## Run it locally

```
npm install
echo GOOGLE_PLACES_API_KEY=... > .dev.vars
npm test
npm run dev     # http://localhost:8788 (ordering needs setup and ANTHROPIC_API_KEY)
```
