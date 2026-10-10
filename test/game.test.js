const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCESS_CODE_ALPHABET,
  BASE_EVIDENCE_IDS,
  COMPANY_IDS,
  PHASES,
  RISK_IDS,
  TEAM_IDS,
  createInitialState,
  joinByCode,
  publicState,
  setActivePitchTeam,
  submitRound,
  transitionPhase,
} = require('../src/game');

const validRound1 = {
  stage: 'peak',
  action: 'pilot',
  mostInfluentialEvidence: 'fast_resolution',
  mainRisk: 'service_quality',
};

function joinedState(teamId = 'team-a', deviceId = 'device-alpha-1234') {
  const state = createInitialState();
  return joinByCode(state, state.teams[teamId].accessCode, deviceId, 'ทีมสายฟ้า').state;
}

function advance(state, phases) {
  return phases.reduce((next, phase) => transitionPhase(next, phase), state);
}

test('initial state uses exactly six approved phases and randomized one-to-one company assignment', () => {
  const state = createInitialState();
  assert.deepEqual(PHASES, ['lobby', 'round1', 'round2', 'reveal', 'pitch', 'takeaway']);
  assert.equal(state.phase, 'lobby');
  assert.deepEqual(Object.keys(state.teams), TEAM_IDS);
  assert.deepEqual(new Set(TEAM_IDS.map((id) => state.teams[id].companyId)), new Set(COMPANY_IDS));
  assert.equal(state.activePitchTeam, 'team-a');
});

test('access codes are unique readable four-character uppercase codes', () => {
  const state = createInitialState();
  const codes = TEAM_IDS.map((id) => state.teams[id].accessCode);
  assert.equal(new Set(codes).size, 3);
  for (const code of codes) {
    assert.match(code, /^[A-Z2-9]{4}$/);
    assert.ok([...code].every((character) => ACCESS_CODE_ALPHABET.includes(character)));
    assert.doesNotMatch(code, /[01ILO]/);
  }
});

test('joining by code maps the player to a server-assigned team and binds its device', () => {
  const state = createInitialState();
  const result = joinByCode(state, state.teams['team-b'].accessCode.toLowerCase(), 'device-beta-1234', 'ทีมคิดไกล');
  assert.equal(result.teamId, 'team-b');
  assert.equal(result.state.teams['team-b'].joined, true);
  assert.equal(result.state.teams['team-b'].deviceId, 'device-beta-1234');
  assert.equal(result.state.teams['team-b'].teamName, 'ทีมคิดไกล');
});

test('team name is required, trimmed, and limited to forty characters', () => {
  const state = createInitialState();
  const code = state.teams['team-a'].accessCode;
  assert.throws(() => joinByCode(state, code, 'device-alpha-1234', ''), /team name/i);
  assert.throws(() => joinByCode(state, code, 'device-alpha-1234', 'x'.repeat(41)), /team name/i);
  const joined = joinByCode(state, code, 'device-alpha-1234', '  ทีมอนาคต  ').state;
  assert.equal(joined.teams['team-a'].teamName, 'ทีมอนาคต');
});

test('same device may rejoin but a different device cannot reuse a joined code', () => {
  const state = createInitialState();
  const code = state.teams['team-c'].accessCode;
  const first = joinByCode(state, code, 'device-one-1234', 'ชื่อเดิม').state;
  assert.equal(joinByCode(first, code, 'device-one-1234', 'ชื่อใหม่').state.teams['team-c'].teamName, 'ชื่อเดิม');
  assert.equal(joinByCode(first, code, 'device-one-1234', 'ชื่อใหม่', true).state.teams['team-c'].teamName, 'ชื่อใหม่');
  assert.throws(() => joinByCode(first, code, 'device-two-5678', 'อีกทีม'), /already joined/i);
});

test('a previously bound device may refresh or rejoin after the lobby', () => {
  let state = joinedState();
  state = transitionPhase(state, 'round1');
  const rejoined = joinByCode(state, state.teams['team-a'].accessCode, 'device-alpha-1234', 'เปลี่ยนไม่ได้', true);
  assert.equal(rejoined.state.teams['team-a'].teamName, 'ทีมสายฟ้า');
});

test('host follows the approved phase sequence and cannot skip or go backward', () => {
  let state = createInitialState();
  for (const phase of PHASES.slice(1)) state = transitionPhase(state, phase);
  assert.equal(state.phase, 'takeaway');
  assert.throws(() => transitionPhase(createInitialState(), 'round2'), /Invalid phase transition/);
  assert.throws(() => transitionPhase(state, 'lobby'), /Invalid phase transition/);
});

test('round phases receive synchronized four-minute deadlines while other phases do not', () => {
  const start = new Date('2026-10-09T12:00:00.000Z');
  let state = transitionPhase(createInitialState(), 'round1', start);
  assert.equal(state.phaseStartedAt, start.toISOString());
  assert.equal(state.roundEndsAt, '2026-10-09T12:04:00.000Z');
  state = transitionPhase(state, 'round2', new Date('2026-10-09T12:05:00.000Z'));
  assert.equal(state.roundEndsAt, '2026-10-09T12:09:00.000Z');
  state = transitionPhase(state, 'reveal', new Date('2026-10-09T12:10:00.000Z'));
  assert.equal(state.roundEndsAt, null);
});

test('timer expiry never locks a round or advances its phase', () => {
  const state = transitionPhase(createInitialState(), 'round1', new Date('2000-01-01T00:00:00.000Z'));
  assert.equal(state.phase, 'round1');
  assert.equal(state.roundEndsAt, '2000-01-01T00:04:00.000Z');
});

test('submission accepts only the four approved fields and can be revised while round is open', () => {
  let state = transitionPhase(joinedState(), 'round1');
  state = submitRound(state, 'team-a', 1, validRound1);
  assert.deepEqual(Object.keys(state.teams['team-a'].round1).sort(), ['action', 'mainRisk', 'mostInfluentialEvidence', 'stage', 'submittedAt'].sort());
  state = submitRound(state, 'team-a', 1, { ...validRound1, action: 'invest' });
  assert.equal(state.teams['team-a'].round1.action, 'invest');
  assert.throws(() => submitRound(state, 'team-a', 1, { ...validRound1, reason: 'legacy' }), /Unknown submission field/);
});

test('submission requires exactly one approved influential evidence and one approved risk', () => {
  const state = transitionPhase(joinedState(), 'round1');
  assert.throws(() => submitRound(state, 'team-a', 1, { ...validRound1, mostInfluentialEvidence: ['fast_resolution'] }), /evidence/i);
  assert.throws(() => submitRound(state, 'team-a', 1, { ...validRound1, mostInfluentialEvidence: 'human_choice' }), /evidence/i);
  assert.throws(() => submitRound(state, 'team-a', 1, { ...validRound1, mainRisk: 'made_up' }), /risk/i);
  assert.ok(BASE_EVIDENCE_IDS.includes(validRound1.mostInfluentialEvidence));
  assert.ok(RISK_IDS.includes(validRound1.mainRisk));
});

test('round two requires round one and may use new-information evidence', () => {
  let missing = joinedState();
  missing = advance(missing, ['round1', 'round2']);
  assert.throws(() => submitRound(missing, 'team-a', 2, { ...validRound1, mostInfluentialEvidence: 'human_choice' }), /Round 1 answer/);

  let state = transitionPhase(joinedState(), 'round1');
  state = submitRound(state, 'team-a', 1, validRound1);
  state = transitionPhase(state, 'round2');
  state = submitRound(state, 'team-a', 2, { ...validRound1, action: 'wait', mostInfluentialEvidence: 'human_choice' });
  assert.equal(state.teams['team-a'].round2.mostInfluentialEvidence, 'human_choice');
});

test('active pitch team changes only during pitch', () => {
  assert.throws(() => setActivePitchTeam(createInitialState(), 'team-c'), /Pitch mode/i);
  const pitch = advance(createInitialState(), ['round1', 'round2', 'reveal', 'pitch']);
  assert.equal(setActivePitchTeam(pitch, 'team-c').activePitchTeam, 'team-c');
});

test('public state hides codes, device identities, company mapping, and answers by default', () => {
  const output = publicState(createInitialState());
  assert.equal(output.teams['team-a'].accessCode, undefined);
  assert.equal(output.teams['team-a'].deviceId, undefined);
  assert.equal(output.teams['team-a'].companyId, undefined);
  assert.equal(output.teams['team-a'].round1, undefined);
  assert.equal(output.teams['team-a'].teamName, null);
});

test('public state uses joined team names as safe primary labels', () => {
  const output = publicState(joinedState());
  assert.equal(output.teams['team-a'].teamName, 'ทีมสายฟ้า');
  assert.equal(output.teams['team-a'].label, 'ทีมสายฟ้า');
  assert.equal(output.teams['team-b'].label, 'Team B');
});

test('device-scoped state reveals only that team company and answers', () => {
  let state = transitionPhase(joinedState(), 'round1');
  state = submitRound(state, 'team-a', 1, validRound1);
  const output = publicState(state, { teamId: 'team-a', deviceId: 'device-alpha-1234' });
  assert.equal(output.teams['team-a'].round1.action, 'pilot');
  assert.ok(COMPANY_IDS.includes(output.teams['team-a'].companyId));
  assert.equal(output.teams['team-b'].companyId, undefined);
  assert.equal(output.teams['team-b'].round1, undefined);
});

test('public pitch state reveals only the selected team company and decisions', () => {
  let state = advance(createInitialState(), ['round1', 'round2', 'reveal', 'pitch']);
  state = setActivePitchTeam(state, 'team-b');
  const output = publicState(state);
  assert.ok(COMPANY_IDS.includes(output.teams['team-b'].companyId));
  assert.equal(output.teams['team-a'].companyId, undefined);
  assert.equal(output.teams['team-c'].companyId, undefined);
});

test('team spectator remains scoped to its own team during another team pitch', () => {
  let state = joinedState('team-a', 'device-alpha-1234');
  state = advance(state, ['round1', 'round2', 'reveal', 'pitch']);
  state = setActivePitchTeam(state, 'team-b');
  const output = publicState(state, { teamId: 'team-a', deviceId: 'device-alpha-1234', spectator: true });
  assert.ok(COMPANY_IDS.includes(output.teams['team-a'].companyId));
  assert.equal(output.teams['team-b'].companyId, undefined);
  assert.equal(output.teams['team-b'].round1, undefined);
});
