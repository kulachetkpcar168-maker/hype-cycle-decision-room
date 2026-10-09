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

test('join endpoint accepts only a code and device identity and returns assigned context', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const code = initial.teams['team-b'].accessCode;
  const join = await handleApiRequest({
    method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-beta-1234' }, store, hostKey: 'key',
  });
  assert.equal(join.status, 200);
  assert.equal(join.body.teamId, 'team-b');
  assert.equal(join.body.state.teams['team-b'].companyId, initial.teams['team-b'].companyId);
  assert.equal(join.body.state.teams['team-a'].companyId, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('joined code is rejected on another device and accepted again on the original device', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const code = initial.teams['team-a'].accessCode;
  const request = (deviceId) => handleApiRequest({ method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId }, store, hostKey: 'key' });
  assert.equal((await request('device-one-1234')).status, 200);
  assert.equal((await request('device-two-5678')).status, 409);
  assert.equal((await request('device-one-1234')).status, 200);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('team-scoped state and mutations require matching code and bound device', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-c';
  const code = initial.teams[teamId].accessCode;
  await handleApiRequest({ method: 'POST', pathname: '/api/join', headers: {}, body: { code, deviceId: 'device-gamma-1234' }, store, hostKey: 'key' });
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
