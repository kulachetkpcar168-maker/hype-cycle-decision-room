# Hype Cycle Decision Room

Mobile-first classroom decision activity. Three server-assigned teams assess Agentic AI for customer service in different company contexts, revise a decision after new information, and pitch their context-sensitive judgment.

## Features
- Rules shown before join; 20-minute activity design
- Four-character team codes with randomized one-to-one company assignments
- First-device binding with same-device refresh/rejoin
- Host-only six-phase flow and synchronized four-minute round timers
- Four-field decisions: stage, action, one influential evidence item, one main risk
- Private company context until the selected team pitch
- No scoring, vote, ranking, leaderboard, or winner

## Local development

```bash
HOST_KEY='replace-me' PORT=4871 npm run dev
npm test
```

Player: `http://localhost:4871/`
Host: `http://localhost:4871/host`

Local state is stored in `data/state.json`. Reset from the host dashboard before a new class.

## Production
Set `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and a strong `HOST_KEY` in Vercel. `GAME_STATE_KEY` is optional. Never commit credentials.
