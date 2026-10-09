# Vercel Deployment — Hype Cycle Decision Room

## Current status
The application is implemented for Vercel with shared production state in Upstash Redis. Local development uses JSON-file storage. The current data model is **schema-v3**.

## Production architecture
- Vercel: static files from `public/` plus Node serverless API functions.
- Upstash Redis: shared room state, randomized context assignment, device binding, phase changes, Round 1/2 submissions, and active pitch team.
- GitHub private repository: source control and deployment source.
- Server-side environment variables: `HOST_KEY`, `GAME_STATE_KEY`, and either the `UPSTASH_REDIS_REST_*` or `KV_REST_API_*` URL/token pair.

Credentials must never be placed in browser JavaScript, documentation, Git, or Obsidian.

## Schema-v3 classroom identity model
- นักเรียน **ทีมตั้งชื่อเอง** เมื่อเข้าร่วมด้วยรหัสสี่ตัว
- ระบบสุ่ม **บริบทธุรกิจจำลอง** ให้แต่ละทีมแบบไม่ซ้ำกัน
- Internal team IDs remain stable (`team-a`, `team-b`, `team-c`), while the UI uses the student-created team name.
- Klarna is the real case; its published metrics are labeled as company-reported evidence.
- The assigned business contexts and the teams' Hype Cycle judgments are not presented as real companies or official Gartner classifications.

## Storage and concurrency safeguards
- Production storage uses Upstash Redis; local development uses file storage only.
- State includes `schemaVersion` and `roomId`.
- Incompatible or malformed Redis room data is atomically replaced.
- Team writes verify the device binding, access code, phase, and expected `roomId` in the same storage operation.
- Public state hides other teams' answers and private contexts until host-controlled reveal/pitch phases.

## Vercel routing
- `/` serves the player interface.
- `/host` rewrites to the facilitator interface.
- `/api/:path*` rewrites to the explicit API entry point using the `route` query value.
- Security headers and Content Security Policy are defined in `vercel.json`.

## Deployment verification checklist
1. Run the full automated test suite, JavaScript syntax checks, and `git diff --check`.
2. Confirm no credentials or local state files are staged.
3. Deploy the verified commit to Vercel.
4. Verify `/`, `/host`, `/api/state`, and the locally hosted QR asset.
5. Exercise reset, three unique joins, duplicate-device rejection, both decision rounds, reveal, pitch selection, and takeaway.
6. Confirm a stale request from an old `roomId` is rejected after reset.
7. Confirm the projected screen does not expose a team's assigned context before its pitch.

## Approval boundary
Public deployment, environment-variable changes, and production reset require owner approval. This document records the approved architecture but does not expose any secret value.


## Reliability configuration
- Pin Vercel Functions to `sin1` (AWS `ap-southeast-1`) and enable Fluid compute for steadier classroom concurrency.
- Set `RATE_LIMIT_READ_PER_MIN=3000` for anonymous `GET /api/state` polling and `RATE_LIMIT_WRITE_PER_MIN=180` for other unauthenticated API traffic. Authenticated host routes bypass these buckets.
- Regenerate the local fallback QR after the production root URL changes with `npm run generate:qr -- <absolute-root-url>` and verify `public/join-qr.svg`; no CDN is used.


## Classroom reliability settings
- Vercel Functions are pinned to `sin1` (AWS `ap-southeast-1`) to keep compute near the Bangkok classroom; enable Vercel Fluid compute for burst handling.
- `RATE_LIMIT_READ_PER_MIN` defaults to `3000` for anonymous `GET /api/state`; `RATE_LIMIT_WRITE_PER_MIN` defaults to `180` for writes and invalid host requests. Authenticated host routes bypass rate limiting.
- The checked-in `public/join-qr.svg` is the offline fallback. Regenerate it with `npm run generate:qr -- https://hype-cycle-decision-room.vercel.app/`.
