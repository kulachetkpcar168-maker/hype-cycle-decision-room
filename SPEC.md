# Hype Cycle Decision Room — MVP Specification

## Scope
A self-hosted classroom web app for one facilitator and exactly three participant teams. No player login, no voting, no scoring, no winner.

## Teams
- startup — NovaCart, a 12-person e-commerce startup with limited runway and high chat volume
- sme — SiamStay, a five-property boutique hotel SME where multilingual service and reviews matter
- corporate — MetroBank, a large regulated bank handling sensitive financial customer service

## Technology case
Klarna / Agentic AI for Customer Service. The technology being positioned is Agentic AI for customer service, not Klarna as a company.

## Game phases
1. lobby
2. round1
3. round1_locked
4. twist
5. round2
6. round2_locked
7. pitch
8. debrief

Only the host can move the phase. The host can reset the game.

## Team submission
Each round stores:
- stage: one of innovation, peak, trough, slope, plateau
- action: one of invest, pilot, wait, stop
- evidence: exactly 3 evidence IDs
- reason: 1–200 characters
- kpi: one allowed KPI
- confidence: integer 1–5
- changedBy: required in round 2, 1–200 characters

A team may revise its current-round answer while that round is open. Submissions are rejected after the phase is locked.

## Player flow
- Open team page from QR/link.
- Choose one of three team contexts.
- Read case and evidence.
- Submit Round 1.
- Wait for host.
- Read Twist evidence.
- Submit Round 2.
- See own before/after result and a 1-minute pitch template.

## Host flow
- See all three teams and submission status.
- Start/lock each round.
- Reveal aggregate Round 1 answers.
- Reveal Twist.
- Show before/after results.
- Enter pitch mode and select a team.
- Show debrief.
- Reset game.

## Technical constraints
- Node.js standard library only; no external runtime dependencies.
- Local development uses JSON-file persistence; production on Vercel uses Upstash Redis as shared persistent state.
- Mobile-first Thai UI.
- Polling for live updates.
- Default port 4871, configurable with PORT.
- Host state-changing API requires HOST_KEY.
