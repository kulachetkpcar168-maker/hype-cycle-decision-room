const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createFileStore, createUpstashStore, deserializeRedisHash, serializeStateFields } = require('../src/store');
const { createInitialState, joinTeam } = require('../src/game');

test('file store initializes and persists state', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-store-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const initial = await store.load();
  const joined = joinTeam(initial, 'startup', 'Alpha');
  await store.saveTeam('startup', joined.teams.startup, joined.updatedAt);
  assert.equal((await store.load()).teams.startup.displayName, 'Alpha');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('redis hash serialization round trips game state', () => {
  const state = joinTeam(createInitialState(), 'sme', 'Hotel Team');
  const restored = deserializeRedisHash(Object.entries(serializeStateFields(state)).flat());
  assert.equal(restored.teams.sme.displayName, 'Hotel Team');
  assert.match(restored.teams.sme.accessToken, /^[A-Za-z0-9_-]{8}$/);
});

test('upstash first load initializes atomically and returns the persisted winner', async () => {
  let persisted = null;
  const commands = [];
  const fakeFetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    commands.push(command);
    assert.equal(command[0], 'EVAL');
    if (!persisted) persisted = command.slice(4);
    return { ok: true, json: async () => ({ result: persisted }) };
  };
  const first = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const second = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const [left, right] = await Promise.all([first.load(), second.load()]);
  assert.equal(commands.length, 2);
  assert.equal(left.teams.startup.accessToken, right.teams.startup.accessToken);
  assert.equal(left.teams.sme.accessToken, right.teams.sme.accessToken);
});

test('upstash store writes only the changed team field', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const state = joinTeam(createInitialState(), 'corporate', 'Bank Team');
  await store.saveTeam('corporate', state.teams.corporate, state.updatedAt);
  assert.deepEqual(commands[0].slice(0, 3), ['HSET', 'room', 'corporate']);
});

test('upstash conditional submission uses atomic phase check', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const state = joinTeam(createInitialState(), 'startup', 'Alpha');
  await store.saveTeamIfPhase('startup', state.teams.startup, state.updatedAt, 'round1');
  assert.equal(commands[0][0], 'EVAL');
  assert.match(commands[0][1], /HGET/);
  assert.equal(commands[0].at(-4), 'round1');
});

test('file store atomically rejects stale team tokens and submission phases', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-store-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const old = await store.load();
  const joined = joinTeam(old, 'startup', 'Stale Team');
  await store.reset();
  await assert.rejects(store.saveTeamIfAccess('startup', joined.teams.startup, joined.updatedAt, old.teams.startup.accessToken), /Invalid team access code/);
  const fresh = await store.load();
  assert.notEqual(fresh.teams.startup.accessToken, old.teams.startup.accessToken);
  assert.equal(fresh.teams.startup.joined, false);
  await assert.rejects(store.saveTeamIfAccess('startup', { ...fresh.teams.startup, joined: true }, fresh.updatedAt, fresh.teams.startup.accessToken, 'round1'), /Round 1 is not open/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('file store rejects a stale phase transition after reset replaces the room', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-store-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const stale = await store.load();
  await store.reset();
  await assert.rejects(
    store.transitionPhase(stale.phase, stale.roomId, 'round1', new Date().toISOString()),
    /state changed/i
  );
  assert.equal((await store.load()).phase, 'lobby');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('file store rejects a stale pitch-team update after reset', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-store-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const stale = await store.load();
  await store.reset();
  await assert.rejects(
    store.setActivePitchTeam(stale.roomId, 'pitch', 'corporate', new Date().toISOString()),
    /state changed/i
  );
  assert.equal((await store.load()).activePitchTeam, 'startup');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('upstash team persistence atomically checks token and required phase', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  const state = joinTeam(createInitialState(), 'startup', 'Alpha');
  await store.saveTeamIfAccess('startup', state.teams.startup, state.updatedAt, state.teams.startup.accessToken, 'round1');
  assert.equal(commands[0][0], 'EVAL');
  assert.match(commands[0][1], /accessToken/);
  assert.equal(commands[0].at(-1), 'round1');
});

test('upstash phase transition uses atomic compare-and-set', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  await store.transitionPhase('lobby', 'room-a', 'round1', 'now');
  assert.deepEqual(commands[0].slice(-4), ['lobby', 'room-a', 'round1', 'now']);
  assert.equal(commands[0][0], 'EVAL');
  assert.match(commands[0][1], /roomId/);
});

test('upstash pitch-team update compares room and phase atomically', async () => {
  const commands = [];
  const fakeFetch = async (_url, options) => { commands.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ result: 1 }) }; };
  const store = createUpstashStore({ url: 'https://example.upstash.io', token: 'test-token', fetchImpl: fakeFetch, key: 'room' });
  await store.setActivePitchTeam('room-a', 'pitch', 'corporate', 'now');
  assert.deepEqual(commands[0].slice(-4), ['room-a', 'pitch', 'corporate', 'now']);
  assert.match(commands[0][1], /activePitchTeam/);
});

test('upstash store rejects missing credentials', () => {
  assert.throws(() => createUpstashStore({ url: '', token: '' }), /credentials/);
});
