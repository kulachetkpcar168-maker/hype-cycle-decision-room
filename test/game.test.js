const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createInitialState,
  joinTeam,
  setActivePitchTeam,
  transitionPhase,
  submitRound,
  publicState,
} = require('../src/game');

const validRound1 = {
  stage: 'peak', action: 'pilot',
  evidence: ['company_volume', 'fast_resolution', 'company_reported'],
  reason: 'ตัวเลขน่าสนใจ แต่ควรทดลองก่อนขยายเพราะเป็นข้อมูลจากบริษัท',
  kpi: 'customer_satisfaction', confidence: 4,
};

test('initial state has three teams, tokens, and starts in lobby', () => {
  const state = createInitialState();
  assert.equal(state.phase, 'lobby');
  assert.deepEqual(Object.keys(state.teams), ['startup', 'sme', 'corporate']);
  assert.equal(state.teams.startup.round1, null);
  assert.equal(state.teams.startup.round2, null);
  assert.match(state.teams.startup.accessToken, /^[A-Za-z0-9_-]{8}$/);
  assert.match(state.roomId, /^[A-Za-z0-9_-]{16}$/);
});

test('host can follow the allowed phase sequence', () => {
  let state = createInitialState();
  state = transitionPhase(state, 'round1');
  state = transitionPhase(state, 'round1_locked');
  state = transitionPhase(state, 'twist');
  assert.equal(state.phase, 'twist');
});

test('active pitch team can change only during pitch phase', () => {
  assert.throws(() => setActivePitchTeam(createInitialState(), 'corporate'), /Pitch mode/i);
  let state = createInitialState();
  for (const phase of ['round1', 'round1_locked', 'twist', 'round2', 'round2_locked', 'pitch']) {
    state = transitionPhase(state, phase);
  }
  state = setActivePitchTeam(state, 'corporate');
  assert.equal(state.activePitchTeam, 'corporate');
});

test('host cannot skip phases', () => {
  assert.throws(() => transitionPhase(createInitialState(), 'twist'), /Invalid phase transition/);
});

test('phase transition cannot return to lobby', () => {
  const state = transitionPhase(createInitialState(), 'round1');
  assert.throws(() => transitionPhase(state, 'lobby'), /Invalid phase transition/);
});

test('team can join only while the room is in lobby', () => {
  const state = transitionPhase(createInitialState(), 'round1');
  assert.throws(() => joinTeam(state, 'startup', 'Late Team'), /lobby/i);
});

test('team can submit and revise round one while open', () => {
  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  state = submitRound(state, 'startup', 1, validRound1);
  assert.equal(state.teams.startup.round1.action, 'pilot');
  state = submitRound(state, 'startup', 1, { ...validRound1, action: 'invest' });
  assert.equal(state.teams.startup.round1.action, 'invest');
});

test('round one submission is rejected after lock', () => {
  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  state = transitionPhase(state, 'round1_locked');
  assert.throws(() => submitRound(state, 'startup', 1, validRound1), /Round 1 is not open/);
});

test('submission requires exactly three distinct allowed evidence items', () => {
  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  assert.throws(() => submitRound(state, 'startup', 1, { ...validRound1, evidence: ['a', 'a', 'b'] }), /exactly 3 distinct evidence/);
  assert.throws(() => submitRound(state, 'startup', 1, { ...validRound1, evidence: ['company_volume', 'fast_resolution', 'made_up'] }), /Unknown evidence/);
});

test('submission rejects unknown properties instead of persisting arbitrary data', () => {
  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  assert.throws(
    () => submitRound(state, 'startup', 1, { ...validRound1, arbitraryBlob: 'x'.repeat(1000) }),
    /Unknown submission field/
  );
});

test('team must join before submitting and round two requires round one', () => {
  const unjoined = transitionPhase(createInitialState(), 'round1');
  assert.throws(() => submitRound(unjoined, 'startup', 1, validRound1), /join/i);

  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  for (const phase of ['round1_locked', 'twist', 'round2']) state = transitionPhase(state, phase);
  assert.throws(() => submitRound(state, 'startup', 2, { ...validRound1, changedBy: 'ข้อมูลใหม่' }), /Round 1 answer/);
});

test('round two requires changedBy explanation', () => {
  let state = joinTeam(createInitialState(), 'sme', 'Hotel');
  state = transitionPhase(state, 'round1');
  state = submitRound(state, 'sme', 1, validRound1);
  for (const phase of ['round1_locked', 'twist', 'round2']) state = transitionPhase(state, phase);
  assert.throws(() => submitRound(state, 'sme', 2, validRound1), /changedBy/);
});

test('public state hides tokens and all team answers by default', () => {
  const output = publicState({ ...createInitialState(), hostKey: 'secret', storagePath: '/tmp/x' });
  assert.equal(output.hostKey, undefined);
  assert.equal(output.storagePath, undefined);
  assert.equal(output.teams.startup.accessToken, undefined);
  assert.equal(output.teams.startup.round1, undefined);
});

test('team-scoped public state reveals only its own answers', () => {
  let state = joinTeam(createInitialState(), 'startup', 'Alpha');
  state = transitionPhase(state, 'round1');
  state = submitRound(state, 'startup', 1, validRound1);
  const output = publicState(state, { teamId: 'startup', teamToken: state.teams.startup.accessToken });
  assert.equal(output.teams.startup.round1.action, 'pilot');
  assert.equal(output.teams.sme.round1, undefined);
  assert.equal(output.teams.startup.accessToken, undefined);
});
