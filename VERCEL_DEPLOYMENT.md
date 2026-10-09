# Vercel Deployment Plan — Hype Cycle Decision Room

## Current status
The local VPS build works with a long-running Node server and JSON-file state. It must not be deployed to Vercel unchanged because shared game state written to the local filesystem is not a reliable persistent datastore for serverless deployments.

## Target free architecture
- Vercel Hobby: static frontend + Node/Express Function
- Upstash Redis Free: shared state for phase, team joins, Round 1/2 answers, and active pitch team
- GitHub personal repository: source and automatic deployments

## Team contexts
1. NovaCart — 12-person e-commerce startup, 2,000 chats/week, 8 months runway, 3 support staff.
2. SiamStay — five-property boutique hotel SME, multilingual booking/refund questions, online reviews affect revenue.
3. MetroBank — large regulated bank, millions of customers, sensitive account/card/payment data.

## Required code migration
1. Add a Redis storage adapter using `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
2. Keep file storage only for local development.
3. Export the HTTP/API app in a Vercel-compatible entry point.
4. Keep static assets under `public/`.
5. Add `vercel.json` only for `/host` rewrite and security/cache headers if required.
6. Run the existing automated test suite against both file storage and an in-memory storage test double.

## Dashboard deployment steps
1. Create a personal GitHub repository for this project and push the verified code.
2. Sign in to Vercel with the same GitHub account.
3. In Vercel, select **New Project**, import the repository, and deploy it under the Hobby plan.
4. Open the project Marketplace/Storage integrations and install **Upstash Redis**; create/link a Free database.
5. Confirm Vercel injected the Upstash REST environment variables.
6. Add a sensitive `HOST_KEY` environment variable in Project Settings → Environment Variables.
7. Redeploy because environment-variable changes affect only new deployments.
8. Verify `/`, `/host`, all three team joins, both submission rounds, locking, pitch mode, reset, and mobile QR access.

## Free-plan constraints
- Vercel Hobby is restricted to personal, non-commercial use. This classroom assignment fits only while it remains educational and non-commercial.
- Upstash Redis Free currently includes 256 MB and 500,000 commands/month; monitor the provider dashboard and do not add billing without owner approval.

## Approval boundaries
- Creating a GitHub repository, connecting Vercel, provisioning Upstash, adding environment variables, and deploying publicly are external state changes and require owner approval.
- Never commit `HOST_KEY` or Redis credentials into Git.

## Sources
- https://vercel.com/docs/plans/hobby
- https://vercel.com/docs/git
- https://vercel.com/docs/frameworks/backend/express
- https://vercel.com/docs/environment-variables/managing-environment-variables
- https://vercel.com/docs/redis
- https://vercel.com/marketplace/upstash
- https://upstash.com/pricing/redis
