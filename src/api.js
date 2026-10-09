const { hostKeysEqual } = require('./request-policy');
const {
  createInitialState,
  joinByCode,
  publicState,
  setActivePitchTeam,
  submitRound,
  transitionPhase,
} = require('./game');

function errorStatus(message) {
  if (/state changed|refresh and retry|already joined/i.test(message)) return 409;
  if (/Invalid team access code|Invalid team credentials/i.test(message)) return 401;
  return /Invalid|Unknown|must|requires|not open|too large|evidence|risk|join|answer|lobby/i.test(message) ? 400 : 500;
}

function playerCredentials(headers) {
  return {
    teamId: headers['x-team-id'],
    code: headers['x-team-code'],
    deviceId: headers['x-device-id'],
  };
}

function validPlayer(state, credentials) {
  const team = state.teams[credentials.teamId];
  return Boolean(team)
    && Boolean(credentials.code)
    && Boolean(credentials.deviceId)
    && team.accessCode === String(credentials.code).toUpperCase()
    && team.deviceId === credentials.deviceId;
}

async function handleApiRequest({ method, pathname, headers = {}, body = {}, store, hostKey }) {
  try {
    if (pathname === '/api/state' && method === 'GET') {
      const state = await store.load();
      const credentials = playerCredentials(headers);
      const viewer = validPlayer(state, credentials)
        ? { teamId: credentials.teamId, deviceId: credentials.deviceId }
        : {};
      return { status: 200, body: publicState(state, viewer) };
    }

    if (pathname === '/api/join' && method === 'POST') {
      const current = await store.load();
      const joined = joinByCode(current, body.code, body.deviceId, body.teamName, body.updateTeamName === true);
      await store.bindDeviceIfAvailable(
        joined.teamId,
        current.roomId,
        current.teams[joined.teamId].accessCode,
        body.deviceId,
        joined.state.teams[joined.teamId].teamName,
        body.updateTeamName === true,
        joined.state.updatedAt
      );
      const state = await store.load();
      return {
        status: 200,
        body: {
          teamId: joined.teamId,
          state: publicState(state, { teamId: joined.teamId, deviceId: body.deviceId }),
        },
      };
    }

    const submitMatch = pathname.match(/^\/api\/teams\/(team-a|team-b|team-c)\/submissions\/(1|2)$/);
    if (submitMatch && method === 'POST') {
      const teamId = submitMatch[1];
      const round = Number(submitMatch[2]);
      const state = await store.load();
      const credentials = playerCredentials(headers);
      if (credentials.teamId !== teamId || !validPlayer(state, credentials)) {
        return { status: 401, body: { error: 'Invalid team credentials' } };
      }
      const next = submitRound(state, teamId, round, body);
      await store.saveTeamIfDevice(
        teamId,
        next.teams[teamId],
        next.updatedAt,
        state.roomId,
        credentials.code,
        credentials.deviceId,
        `round${round}`
      );
      const saved = await store.load();
      return { status: 200, body: publicState(saved, { teamId, deviceId: credentials.deviceId }) };
    }

    if (pathname.startsWith('/api/host/')) {
      if (!hostKeysEqual(hostKey, headers['x-host-key'])) {
        return { status: 401, body: { error: 'Invalid host key' } };
      }

      if (pathname === '/api/host/state' && method === 'GET') {
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/phase' && method === 'POST') {
        const current = await store.load();
        const next = transitionPhase(current, body.phase);
        await store.transitionPhase(current.phase, current.roomId, {
          phase: next.phase,
          phaseStartedAt: next.phaseStartedAt,
          roundEndsAt: next.roundEndsAt,
          updatedAt: next.updatedAt,
        });
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/pitch-team' && method === 'POST') {
        const current = await store.load();
        const next = setActivePitchTeam(current, body.teamId);
        await store.setActivePitchTeam(current.roomId, current.phase, next.activePitchTeam, next.updatedAt);
        return { status: 200, body: await store.load() };
      }

      if (pathname === '/api/host/release-device' && method === 'POST') {
        const fields = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body).sort() : [];
        if (fields.join(',') !== 'roomId,teamId') throw new Error('Invalid release request');
        if (!['team-a', 'team-b', 'team-c'].includes(body.teamId) || typeof body.roomId !== 'string') throw new Error('Invalid release request');
        const expectedDeviceId = headers['x-expected-device-id'];
        if (typeof expectedDeviceId !== 'string' || expectedDeviceId.length < 8) throw new Error('Invalid release request');
        await store.releaseDevice(body.teamId, body.roomId, expectedDeviceId, new Date().toISOString());
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
