# Hype Cycle Decision Room — Approved Classroom Specification

## Purpose
A 20-minute, non-competitive classroom activity for one facilitator and exactly three teams. Teams use the same Agentic AI customer-service evidence to make context-sensitive strategic judgments. There is no score, vote, ranking, leaderboard, winner, or universal correct action.

## Activity timing
Rules 2 minutes; code assignment 1; Round 1 4; new-information transition 1; Round 2 4; reveal 2; pitches 6 (2 minutes each). Takeaway/debrief is outside the 20-minute activity. Pitch screens show no timer.

## Teams and access
The server creates Team A, Team B, and Team C. On every reset it randomly maps NovaCart, SiamStay, and MetroBank one-to-one to those labels and creates unique readable four-character uppercase codes excluding ambiguous characters. Players never select a team or company; they enter a code. The first join binds that team to a client-generated deviceId. The same device may refresh/rejoin; another device is rejected until reset. The browser persists teamId, code, and deviceId in localStorage. Codes and device identities are never returned by public state.

## Phases
Exactly: `lobby`, `round1`, `round2`, `reveal`, `pitch`, `takeaway`. Only the host changes phase. Entering Round 1 or Round 2 sets a server-synchronized four-minute deadline. At 30 seconds the UI warns. Zero neither advances nor locks the round.

## Decisions
Each round accepts only `stage`, `action`, exactly one `mostInfluentialEvidence`, and exactly one `mainRisk`. Stage is innovation, peak, trough, slope, or plateau. Action is invest, pilot, wait, or stop. Evidence and risk values must be approved IDs. Teams may explicitly edit/resubmit while the phase remains open. After submission the player sees a dedicated saved/waiting state. Round 2 shows the Round 1 answer and new information together.

## Projection privacy and pitch
Before pitch, the projected dashboard shows only Team A/B/C, access codes, join/submission status, phase, and round timer—not company identities. During pitch, only the selected team's company is shown, with before/after decisions, influential evidence, main risk, and speaking guide. No pitch timer is displayed.

## Takeaway
“Same technology. Same evidence. Different context. Different action.” The Hype Cycle informs strategic judgment rather than prescribing a universal decision.

## Technical constraints
Node.js standard library only. Local JSON persistence; Upstash Redis in production. Preserve host authentication, roomId compare-and-set, atomic joins/submissions, request limits, safe public projection, and no committed credentials.
