const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFileStore, createUpstashStore, deserializeRedisHash, serializeStateFields } = require('../src/store');
const { createInitialState } = require('../src/game');

function tempStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-store-'));
  return { dir, store: createFileStore(path.join(dir, 'state.json')) };
}

test('redis serialization preserves timers, mappings, codes, and device bindings', () => {
  const state = createInitialState();
  state.phase = 'round1';
  state.phaseStartedAt = '2026-10-09T12:00:00.000Z';
  state.roundEndsAt = '2026-10-09T12:04:00.000Z';
  state.teams['team-a'].deviceId = 'device-alpha-1234';
  const restored = deserializeRedisHash(Object.entries(serializeStateFields(state)).flat());
  assert.equal(restored.roundEndsAt, state.roundEndsAt);
  assert.equal(restored.teams['team-a'].companyId, state.teams['team-a'].companyId);
  assert.equal(restored.teams['team-a'].accessCode, state.teams['team-a'].accessCode);
  assert.equal(restored.teams['team-a'].deviceId, 'device-alpha-1234');
});

test('file store atomically binds one device and rejects another', async () => {
  const { dir, store } = tempStore();
  const state = await store.load();
  const team = state.teams['team-a'];
  await store.bindDeviceIfAvailable('team-a', state.roomId, team.accessCode, 'device-one-1234', 'now');
  await assert.rejects(store.bindDeviceIfAvailable('team-a', state.roomId, team.accessCode, 'device-two-5678', 'later'), /already joined/i);
  assert.equal((await store.load()).teams['team-a'].deviceId, 'device-one-1234');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('file store checks room, device credentials, and phase on atomic writes', async () => {
  const { dir, store } = tempStore();
  const state = await store.load();
  const team = state.teams['team-b'];
  await store.bindDeviceIfAvailable('team-b', state.roomId, team.accessCode, 'device-beta-1234', 'now');
  await assert.rejects(store.saveTeamIfDevice('team-b', team, 'later', state.roomId, team.accessCode, 'wrong-device', 'round1'), /credentials/i);
  await assert.rejects(store.saveTeamIfDevice('team-b', team, 'later', state.roomId, team.accessCode, 'device-beta-1234', 'round1'), /not open/i);
  await store.reset();
  await assert.rejects(store.transitionPhase('lobby', state.roomId, { phase: 'round1', updatedAt: 'now' }), /state changed/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Upstash device binding, submission, and phase updates are atomic Lua operations', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const state = createInitialState();
  await store.bindDeviceIfAvailable('team-a', state.roomId, state.teams['team-a'].accessCode, 'device-alpha-1234', 'now');
  await store.saveTeamIfDevice('team-a', state.teams['team-a'], 'later', state.roomId, state.teams['team-a'].accessCode, 'device-alpha-1234', 'round1');
  await store.transitionPhase('lobby', state.roomId, { phase: 'round1', phaseStartedAt: 'start', roundEndsAt: 'end', updatedAt: 'start' });
  assert.equal(commands.length, 3);
  assert.ok(commands.every((command) => command[0] === 'EVAL'));
  assert.match(commands[0][1], /deviceId/);
  assert.match(commands[1][1], /PHASE_LOCKED/);
  assert.match(commands[1][1], /roomId/);
  assert.deepEqual(commands[2].slice(-6), ['lobby', state.roomId, 'round1', 'start', 'end', 'start']);
});

test('Upstash initialization is atomic and credential aliases remain supported', async () => {
  let persisted = null;
  const fakeFetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (!persisted) persisted = command.slice(4);
    return { ok: true, json: async () => ({ result: persisted }) };
  };
  const first = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const second = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const [left, right] = await Promise.all([first.load(), second.load()]);
  assert.equal(left.roomId, right.roomId);
  assert.equal(left.teams['team-a'].accessCode, right.teams['team-a'].accessCode);
  assert.throws(() => createUpstashStore({ url: '', token: '' }), /credentials/);
});

test('file store rejects a stale submission after reset even when credentials are replayed', async () => {
  const { dir, store } = tempStore();
  const old = await store.load();
  const staleTeam = { ...old.teams['team-a'], joined: true, deviceId: 'device-alpha-1234' };
  const replacement = createInitialState();
  replacement.phase = 'round1';
  replacement.teams['team-a'] = { ...replacement.teams['team-a'], accessCode: staleTeam.accessCode, deviceId: staleTeam.deviceId, joined: true };
  await store.reset(replacement);
  await assert.rejects(store.saveTeamIfDevice('team-a', staleTeam, 'later', old.roomId, staleTeam.accessCode, staleTeam.deviceId, 'round1'), /state changed/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Upstash load atomically replaces incomplete schema-v2 state and keeps the replacement stable', async () => {
  const commands = [];
  let persisted = ['schemaVersion', '2', 'roomId', 'legacy-room', 'phase', 'lobby', 'team-a', '{bad'];
  const fakeFetch = async (_url, options) => {
    const command = JSON.parse(options.body); commands.push(command);
    const fields = Object.fromEntries(Array.from({ length: persisted.length / 2 }, (_, index) => [persisted[index * 2], persisted[index * 2 + 1]]));
    let valid = fields.schemaVersion === '2' && ['team-a', 'team-b', 'team-c'].every((id) => {
      try { const team = JSON.parse(fields[id]); return team.id === id && team.accessCode && team.companyId; } catch { return false; }
    });
    if (!valid) persisted = command.slice(4);
    return { ok: true, json: async () => ({ result: persisted }) };
  };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const first = await store.load();
  const second = await store.load();
  assert.equal(first.schemaVersion, 2);
  assert.equal(first.roomId, second.roomId);
  assert.equal(first.teams['team-a'].accessCode, second.teams['team-a'].accessCode);
  assert.match(commands[0][1], /pcall\(cjson\.decode/);
  assert.match(commands[0][1], /type\(team\)~='table'/);
  assert.match(commands[0][1], /team\.accessCode==''/);
  assert.match(commands[0][1], /team\.companyId==''/);
  assert.match(commands[0][1], /DEL/);
  assert.equal(deserializeRedisHash(['schemaVersion', '2', 'roomId', 'x', 'phase', 'lobby', 'team-a', 'null']), null);
});
