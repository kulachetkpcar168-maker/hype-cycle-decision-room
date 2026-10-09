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

test('generic API handler joins a team and returns team-scoped state', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const headers = { 'x-team-token': initial.teams.sme.accessToken };
  const join = await handleApiRequest({ method: 'POST', pathname: '/api/teams/sme/join', headers, body: { displayName: 'Hotel Team' }, store, hostKey: 'key' });
  assert.equal(join.status, 200);
  assert.equal(join.body.teams.sme.displayName, 'Hotel Team');
  assert.equal(join.body.teams.startup.round1, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('team mutation requires its matching capability token', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/teams/startup/join', headers: { 'x-team-token': 'wrong' }, body: { displayName: 'Attacker' }, store, hostKey: 'key' });
  assert.equal(result.status, 401);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('authenticated host state includes team access tokens', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'GET', pathname: '/api/host/state', headers: { 'x-host-key': 'key' }, body: {}, store, hostKey: 'key' });
  assert.equal(result.status, 200);
  assert.match(result.body.teams.startup.accessToken, /^[A-Za-z0-9_-]{8}$/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('generic API handler persists host phase separately', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  assert.equal(result.status, 200);
  assert.equal((await store.load()).phase, 'round1');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('host phase transition is an atomic compare-and-set', async () => {
  const { dir, store } = setup();
  const request = () => handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  const results = await Promise.all([request(), request()]);
  assert.deepEqual(results.map((result) => result.status).sort(), [200, 409]);
  assert.equal((await store.load()).phase, 'round1');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('host phase endpoint cannot reset the game to lobby', async () => {
  const { dir, store } = setup();
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'round1' }, store, hostKey: 'key' });
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: { 'x-host-key': 'key' }, body: { phase: 'lobby' }, store, hostKey: 'key' });
  assert.equal(result.status, 400);
  assert.equal((await store.load()).phase, 'round1');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('generic API handler returns 401 for invalid host key', async () => {
  const { dir, store } = setup();
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/host/reset', headers: {}, body: {}, store, hostKey: 'key' });
  assert.deepEqual(result, { status: 401, body: { error: 'Invalid host key' } });
  fs.rmSync(dir, { recursive: true, force: true });
});
