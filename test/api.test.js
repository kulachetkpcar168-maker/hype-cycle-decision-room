const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handleApiRequest } = require('../src/api');
const { createFileStore } = require('../src/store');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-api-'));
  return { dir, store: createFileStore(path.join(dir, 'state.json')) };
}

function playerHeaders(teamId, code, deviceId = 'device-alpha-1234') {
  return { 'x-team-id': teamId, 'x-team-code': code, 'x-device-id': deviceId };
}

const decision = {
  stage: 'peak', action: 'pilot', mostInfluentialEvidence: 'fast_resolution', mainRisk: 'service_quality',
};

test('join endpoint requires a team name with code and device identity and returns assigned context', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const code = initial.teams['team-b'].accessCode;
  const join = await handleApiRequest({
    method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-beta-1234', teamName: 'ทีมคิดไกล' }, store, hostKey: 'key',
  });
  assert.equal(join.status, 200);
  assert.equal(join.body.teamId, 'team-b');
  assert.equal(join.body.state.teams['team-b'].companyId, initial.teams['team-b'].companyId);
  assert.equal(join.body.state.teams['team-b'].teamName, 'ทีมคิดไกล');
  assert.equal(join.body.state.teams['team-a'].companyId, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('joined code is rejected on another device and accepted again on the original device', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const code = initial.teams['team-a'].accessCode;
  const request = (deviceId, teamName = 'ทีมเดิม', updateTeamName = false) => handleApiRequest({ method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId, teamName, updateTeamName }, store, hostKey: 'key' });
  assert.equal((await request('device-one-1234')).status, 200);
  assert.equal((await request('device-two-5678')).status, 409);
  assert.equal((await request('device-one-1234', 'ชื่อใหม่')).body.state.teams['team-a'].teamName, 'ทีมเดิม');
  assert.equal((await request('device-one-1234', 'ชื่อใหม่', true)).body.state.teams['team-a'].teamName, 'ชื่อใหม่');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('joined team receives a signed read-only spectator token', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-b';
  const code = initial.teams[teamId].accessCode;
  const join = await handleApiRequest({
    method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-main-1234', teamName: 'ทีมร่วมคิด' }, store, hostKey: 'key',
  });
  assert.equal(join.status, 200);
  assert.match(join.body.spectatorToken, /^[A-Za-z0-9_-]{22}$/);

  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  const watched = await handleApiRequest({
    method: 'GET', pathname: '/api/state', headers: { 'x-spectator-team': teamId, 'x-spectator-token': join.body.spectatorToken }, body: {}, store, hostKey: 'key',
  });
  assert.equal(watched.status, 200);
  assert.equal(watched.body.teams[teamId].companyId, initial.teams[teamId].companyId);
  assert.equal(watched.body.teams['team-a'].companyId, undefined);

  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round2' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'reveal' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'pitch' }, store, hostKey: 'key' });
  const pitchWatch = await handleApiRequest({
    method: 'GET', pathname: '/api/state', headers: { 'x-spectator-team': teamId, 'x-spectator-token': join.body.spectatorToken }, body: {}, store, hostKey: 'key',
  });
  assert.equal(pitchWatch.body.teams[teamId].companyId, initial.teams[teamId].companyId);
  assert.equal(pitchWatch.body.teams['team-a'].companyId, undefined);

  const invalid = await handleApiRequest({
    method: 'GET', pathname: '/api/state', headers: { 'x-spectator-team': teamId, 'x-spectator-token': 'invalid-token-12345678' }, body: {}, store, hostKey: 'key',
  });
  assert.equal(invalid.status, 401);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('spectator credentials never authorize team submissions', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-a';
  const code = initial.teams[teamId].accessCode;
  const join = await handleApiRequest({
    method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-main-1234', teamName: 'ทีมหลัก' }, store, hostKey: 'key',
  });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  const denied = await handleApiRequest({
    method: 'POST', pathname: `/api/teams/${teamId}/submissions/1`, headers: { 'x-spectator-team': teamId, 'x-spectator-token': join.body.spectatorToken }, body: decision, store, hostKey: 'key',
  });
  assert.equal(denied.status, 401);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('team-scoped state and mutations require matching code and bound device', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-c';
  const code = initial.teams[teamId].accessCode;
  await handleApiRequest({ method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-gamma-1234', teamName: 'ทีมแกมมา' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });

  const denied = await handleApiRequest({ method: 'POST', pathname: `/api/teams/${teamId}/submissions/1`, headers: playerHeaders(teamId, code, 'other-device-1234'), body: decision, store, hostKey: 'key' });
  assert.equal(denied.status, 401);
  const accepted = await handleApiRequest({ method: 'POST', pathname: `/api/teams/${teamId}/submissions/1`, headers: playerHeaders(teamId, code, 'device-gamma-1234'), body: decision, store, hostKey: 'key' });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.teams[teamId].round1.action, 'pilot');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('public state never exposes codes, devices, or hidden company identities', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'GET', pathname: '/api/state', headers: {}, body: {}, store, hostKey: 'key' });
  assert.equal(result.status, 200);
  assert.equal(result.body.teams['team-a'].accessCode, undefined);
  assert.equal(result.body.teams['team-a'].deviceId, undefined);
  assert.equal(result.body.teams['team-a'].companyId, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('authenticated host sees readable codes and server mappings', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'GET', pathname: '/api/host/state', headers: { 'x-host-key': 'key' }, body: {}, store, hostKey: 'key' });
  assert.equal(result.status, 200);
  assert.match(result.body.teams['team-a'].accessCode, /^[A-Z2-9]{4}$/);
  assert.ok(result.body.teams['team-a'].companyId);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('host phase transition remains an atomic roomId compare-and-set', async () => {
  const { dir, store } = setup();
  const request = () => handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  const results = await Promise.all([request(), request()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await store.load()).phase, 'round1');
  assert.ok((await store.load()).roundEndsAt);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('invalid host key is rejected', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/host/reset', headers: {}, body: {}, store, hostKey: 'key' });
  assert.deepEqual(result, { status: 401, body: { error: 'Invalid host key' } });
  fs.rmSync(dir, { recursive: true, force: true });
});
