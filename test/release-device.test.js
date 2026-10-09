const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handleApiRequest } = require('../src/api');
const { createFileStore, createUpstashStore } = require('../src/store');

function setup() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-release-'));
  return { dir, store: createFileStore(path.join(dir, 'state.json')) };
}

const decision = { stage: 'peak', action: 'pilot', mostInfluentialEvidence: 'fast_resolution', mainRisk: 'service_quality' };
const host = { 'x-host-key': 'key' };

test('host release is a roomId CAS and old device immediately loses submission access', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-a';
  const code = initial.teams[teamId].accessCode;
  const oldDevice = 'device-old-1234';
  await handleApiRequest({ method: 'POST', pathname: '/api/join', body: { code, deviceId: oldDevice, teamName: 'ทีมเดิม' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: host, body: { phase: 'round1' }, store, hostKey: 'key' });
  const roomId = (await store.load()).roomId;
  const released = await handleApiRequest({ method: 'POST', pathname: '/api/host/release-device', headers: { ...host, 'x-expected-device-id': oldDevice }, body: { teamId, roomId }, store, hostKey: 'key' });
  assert.equal(released.status, 200);
  assert.equal(released.body.teams[teamId].deviceId, null);
  const stale = await handleApiRequest({ method: 'POST', pathname: `/api/teams/${teamId}/submissions/1`, headers: { 'x-team-id': teamId, 'x-team-code': code, 'x-device-id': oldDevice }, body: decision, store, hostKey: 'key' });
  assert.equal(stale.status, 401);
  const staleRoom = await handleApiRequest({ method: 'POST', pathname: '/api/host/release-device', headers: { ...host, 'x-expected-device-id': oldDevice }, body: { teamId, roomId: 'wrong-room' }, store, hostKey: 'key' });
  assert.equal(staleRoom.status, 409);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('released joined team rebinds in any phase preserving name, context, and answers', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  const teamId = 'team-b';
  const code = initial.teams[teamId].accessCode;
  await handleApiRequest({ method: 'POST', pathname: '/api/join', body: { code, deviceId: 'device-old-1234', teamName: 'ชื่อคงเดิม' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: '/api/host/phase', headers: host, body: { phase: 'round1' }, store, hostKey: 'key' });
  await handleApiRequest({ method: 'POST', pathname: `/api/teams/${teamId}/submissions/1`, headers: { 'x-team-id': teamId, 'x-team-code': code, 'x-device-id': 'device-old-1234' }, body: decision, store, hostKey: 'key' });
  const before = await store.load();
  await handleApiRequest({ method: 'POST', pathname: '/api/host/release-device', headers: { ...host, 'x-expected-device-id': 'device-old-1234' }, body: { teamId, roomId: before.roomId }, store, hostKey: 'key' });
  const rebound = await handleApiRequest({ method: 'POST', pathname: '/api/join', body: { code, deviceId: 'device-new-5678', teamName: 'พยายามเปลี่ยนชื่อ', updateTeamName: true }, store, hostKey: 'key' });
  assert.equal(rebound.status, 200);
  const after = await store.load();
  assert.equal(after.teams[teamId].deviceId, 'device-new-5678');
  assert.equal(after.teams[teamId].teamName, 'ชื่อคงเดิม');
  assert.equal(after.teams[teamId].companyId, before.teams[teamId].companyId);
  assert.deepEqual(after.teams[teamId].round1, before.teams[teamId].round1);
  const replay = await handleApiRequest({ method: 'POST', pathname: '/api/host/release-device', headers: { ...host, 'x-expected-device-id': 'device-old-1234' }, body: { teamId, roomId: before.roomId }, store, hostKey: 'key' });
  assert.equal(replay.status, 409);
  assert.equal((await store.load()).teams[teamId].deviceId, 'device-new-5678');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('never-joined released-looking team remains lobby-only', async () => {
  const { dir, store } = setup();
  const initial = await store.load();
  await store.transitionPhase('lobby', initial.roomId, { phase: 'round1', phaseStartedAt: 'now', roundEndsAt: 'later', updatedAt: 'now' });
  const result = await handleApiRequest({ method: 'POST', pathname: '/api/join', body: { code: initial.teams['team-c'].accessCode, deviceId: 'device-new-1234', teamName: 'ทีมใหม่' }, store, hostKey: 'key' });
  assert.equal(result.status, 400);
  assert.match(result.body.error, /lobby/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Upstash release uses atomic Lua room CAS and only clears device identity', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'token', fetchImpl: fakeFetch, key: 'room' });
  await store.releaseDevice('team-a', 'room-id', 'device-old-1234', 'now');
  assert.equal(commands[0][0], 'EVAL');
  assert.match(commands[0][1], /roomId/);
  assert.match(commands[0][1], /STATE_CHANGED/);
  assert.match(commands[0][1], /deviceId~=ARGV\[3\]/);
  assert.match(commands[0][1], /deviceId=cjson\.null/);
  assert.doesNotMatch(commands[0][1], /round1=cjson\.null|round2=cjson\.null|teamName=cjson\.null|companyId=cjson\.null/);
});
