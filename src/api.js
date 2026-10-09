const {
  createInitialState,
  joinTeam,
  publicState,
  setActivePitchTeam,
  submitRound,
  transitionPhase,
} = require('./game');

function errorStatus(message) {
  if (/state changed|refresh and retry/i.test(message)) return 409;
  if (/Invalid team access code/i.test(message)) return 401;
  return /Invalid|Unknown|must|requires|not open|too large|evidence|join|answer/i.test(message) ? 400 : 500;
}

function teamViewer(headers) {
  return { teamId: headers['x-team-id'], teamToken: headers['x-team-token'] };
}

function validTeamToken(state, teamId, headers) {
  return Boolean(headers['x-team-token']) && state.teams[teamId]?.accessToken === headers['x-team-token'];
}

async function handleApiRequest({ method, pathname, headers = {}, body = {}, store, hostKey }) {
  try {
    if (pathname === '/api/state' && method === 'GET') {
      const state = await store.load();
      return { status: 200, body: publicState(state, teamViewer(headers)) };
    }

    const teamJoinMatch = pathname.match(/^\/api\/teams\/(startup|sme|corporate)\/join$/);
    if (teamJoinMatch && method === 'POST') {
      const teamId = teamJoinMatch[1];
      const state = await store.load();
      if (!validTeamToken(state, teamId, headers)) return { status: 401, body: { error: 'Invalid team access code' } };
      const next = joinTeam(state, teamId, body.displayName);
      await store.saveTeamIfAccess(teamId, next.teams[teamId], next.updatedAt, headers['x-team-token'], 'lobby');
      return { status: 200, body: publicState(await store.load(), { teamId, teamToken: headers['x-team-token'] }) };
    }

    const submitMatch = pathname.match(/^\/api\/teams\/(startup|sme|corporate)\/submissions\/(1|2)$/);
    if (submitMatch && method === 'POST') {
      const teamId = submitMatch[1];
      const round = Number(submitMatch[2]);
      const state = await store.load();
      if (!validTeamToken(state, teamId, headers)) return { status: 401, body: { error: 'Invalid team access code' } };
      const next = submitRound(state, teamId, round, body);
      await store.saveTeamIfAccess(
        teamId,
        next.teams[teamId],
        next.updatedAt,
        headers['x-team-token'],
        round === 1 ? 'round1' : 'round2'
      );
      return { status: 200, body: publicState(await store.load(), { teamId, teamToken: headers['x-team-token'] }) };
    }

    if (pathname.startsWith('/api/host/')) {
      if (!hostKey || headers['x-host-key'] !== hostKey) {
        return { status: 401, body: { error: 'Invalid host key' } };
      }

      if (pathname === '/api/host/state' && method === 'GET') {
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/phase' && method === 'POST') {
        const current = await store.load();
        const next = transitionPhase(current, body.phase);
        await store.transitionPhase(current.phase, current.roomId, next.phase, next.updatedAt);
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/pitch-team' && method === 'POST') {
        const current = await store.load();
        const next = setActivePitchTeam(current, body.teamId);
        await store.setActivePitchTeam(current.roomId, current.phase, next.activePitchTeam, next.updatedAt);
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/reset' && method === 'POST') {
        const next = createInitialState();
        await store.reset(next);
        return { status: 200, body: next };
      }
    }

    return { status: 404, body: { error: 'Not found' } };
  } catch (error) {
    return { status: errorStatus(error.message), body: { error: error.message } };
  }
}

module.exports = { handleApiRequest };
