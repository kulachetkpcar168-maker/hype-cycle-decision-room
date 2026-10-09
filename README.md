# Hype Cycle Decision Room

Mobile-first classroom decision game for Gartner Technology Hype Cycle. Three teams analyze the same Klarna/Agentic AI evidence from different business contexts, revise their decision after a twist, and deliver a one-minute pitch.

## Teams
- NovaCart — e-commerce startup
- SiamStay — boutique hotel SME
- MetroBank — regulated financial corporate

## Features
- Host-controlled phases
- Round 1 and Round 2 submissions
- Exactly three evidence selections
- Invest / Pilot / Wait / Stop actions
- Before/after result and pitch mode
- No player accounts, voting, scoring, or winner

## Local development

```bash
HOST_KEY='replace-me' PORT=4871 npm start
npm test
```

Player: `http://localhost:4871/`

Host: `http://localhost:4871/host`

Local development stores state in `data/state.json`.

## Vercel deployment

Production requires these environment variables:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
HOST_KEY
GAME_STATE_KEY (optional)
```

Connect an Upstash Redis resource to the Vercel project, set a strong `HOST_KEY`, and redeploy. Vercel uses the catch-all function under `api/[...route].js`; static assets are served from `public/`.

## Safety
- Never commit `.env`, Redis credentials, or the host key.
- Use the Vercel environment-variable dashboard.
- Reset the room from the host dashboard before a new class run.
