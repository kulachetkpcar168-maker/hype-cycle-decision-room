const crypto = require('node:crypto');

const PHASES = ['lobby', 'round1', 'round2', 'reveal', 'pitch', 'takeaway'];
const TEAM_IDS = ['team-a', 'team-b', 'team-c'];
const COMPANY_IDS = ['startup', 'sme', 'corporate'];
const STAGES = ['innovation', 'peak', 'trough', 'slope', 'plateau'];
const ACTIONS = ['invest', 'pilot', 'wait', 'stop'];
const BASE_EVIDENCE_IDS = [
  'company_volume', 'two_thirds', 'fte_equivalent', 'fast_resolution',
  'repeat_drop', 'languages', 'profit_projection',
];
const NEW_EVIDENCE_IDS = [
  'human_choice', 'complex_escalation', 'quality_tradeoff', 'hybrid_model', 'workflow_matters',
];
const EVIDENCE_IDS = [...BASE_EVIDENCE_IDS, ...NEW_EVIDENCE_IDS];
const RISK_IDS = [
  'service_quality', 'customer_trust', 'implementation_complexity',
  'compliance_privacy', 'financial_exposure', 'workforce_dependency',
];
const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ROUND_DURATION_MS = 4 * 60 * 1000;

function shuffle(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = crypto.randomInt(index + 1);
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function createAccessCode() {
  return Array.from({ length: 4 }, () => ACCESS_CODE_ALPHABET[crypto.randomInt(ACCESS_CODE_ALPHABET.length)]).join('');
}

function createUniqueCodes() {
  const codes = new Set();
  while (codes.size < TEAM_IDS.length) codes.add(createAccessCode());
  return [...codes];
}

function createInitialState() {
  const companies = shuffle(COMPANY_IDS);
  const codes = createUniqueCodes();
  return {
    schemaVersion: 3,
    roomId: crypto.randomBytes(12).toString('base64url'),
    phase: 'lobby',
    phaseStartedAt: null,
    roundEndsAt: null,
    activePitchTeam: 'team-a',
    updatedAt: new Date().toISOString(),
    teams: Object.fromEntries(TEAM_IDS.map((id, index) => [id, {
      id,
      label: `Team ${String.fromCharCode(65 + index)}`,
      teamName: null,
      companyId: companies[index],
      accessCode: codes[index],
      deviceId: null,
      joined: false,
      round1: null,
      round2: null,
    }])),
  };
}

function clone(value) {
  return structuredClone(value);
}

function transitionPhase(state, nextPhase, now = new Date()) {
  const currentIndex = PHASES.indexOf(state.phase);
  const nextIndex = PHASES.indexOf(nextPhase);
  if (currentIndex === -1 || nextIndex !== currentIndex + 1) {
    throw new Error(`Invalid phase transition: ${state.phase} -> ${nextPhase}`);
  }
  const next = clone(state);
  const startedAt = new Date(now);
  next.phase = nextPhase;
  next.phaseStartedAt = startedAt.toISOString();
  next.roundEndsAt = ['round1', 'round2'].includes(nextPhase)
    ? new Date(startedAt.getTime() + ROUND_DURATION_MS).toISOString()
    : null;
  next.updatedAt = startedAt.toISOString();
  return next;
}

function normalizeDeviceId(deviceId) {
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(deviceId)) {
    throw new Error('Invalid device identity');
  }
  return deviceId;
}

function normalizeTeamName(teamName) {
  const normalized = typeof teamName === 'string' ? teamName.trim().replace(/\s+/g, ' ') : '';
  if (normalized.length < 1 || normalized.length > 40) throw new Error('Invalid team name: use 1-40 characters');
  return normalized;
}

function joinByCode(state, code, deviceId, teamName, updateTeamName = false) {
  const normalizedCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
  const normalizedDevice = normalizeDeviceId(deviceId);
  const teamId = TEAM_IDS.find((id) => state.teams[id].accessCode === normalizedCode);
  if (!teamId) throw new Error('Invalid team access code');
  const team = state.teams[teamId];
  if (team.deviceId && team.deviceId !== normalizedDevice) throw new Error('This team code is already joined on another device');
  if (!team.deviceId && !team.joined && state.phase !== 'lobby') throw new Error('New teams can join only during lobby');
  const normalizedName = team.joined && (!updateTeamName || state.phase !== 'lobby') ? team.teamName : normalizeTeamName(teamName);
  const next = clone(state);
  next.teams[teamId].joined = true;
  next.teams[teamId].deviceId = normalizedDevice;
  if (!team.joined || (state.phase === 'lobby' && updateTeamName)) next.teams[teamId].teamName = normalizedName;
  next.updatedAt = new Date().toISOString();
  return { state: next, teamId };
}

function validateSubmission(round, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Invalid submission');
  const allowedFields = new Set(['stage', 'action', 'mostInfluentialEvidence', 'mainRisk']);
  const unknownField = Object.keys(payload).find((field) => !allowedFields.has(field));
  if (unknownField) throw new Error(`Unknown submission field: ${unknownField}`);
  if (!STAGES.includes(payload.stage)) throw new Error('Invalid stage');
  if (!ACTIONS.includes(payload.action)) throw new Error('Invalid action');
  const allowedEvidence = round === 1 ? BASE_EVIDENCE_IDS : EVIDENCE_IDS;
  if (typeof payload.mostInfluentialEvidence !== 'string' || !allowedEvidence.includes(payload.mostInfluentialEvidence)) {
    throw new Error('Select exactly one approved influential evidence item');
  }
  if (typeof payload.mainRisk !== 'string' || !RISK_IDS.includes(payload.mainRisk)) {
    throw new Error('Select exactly one approved main risk');
  }
}

function submitRound(state, teamId, round, payload) {
  if (!TEAM_IDS.includes(teamId)) throw new Error('Unknown team');
  if (![1, 2].includes(round)) throw new Error('Unknown round');
  if (state.phase !== `round${round}`) throw new Error(`Round ${round} is not open`);
  if (!state.teams[teamId].joined) throw new Error('Team must join before submitting');
  if (round === 2 && !state.teams[teamId].round1) throw new Error('Round 1 answer is required before Round 2');
  validateSubmission(round, payload);
  const next = clone(state);
  next.teams[teamId][`round${round}`] = {
    stage: payload.stage,
    action: payload.action,
    mostInfluentialEvidence: payload.mostInfluentialEvidence,
    mainRisk: payload.mainRisk,
    submittedAt: new Date().toISOString(),
  };
  next.updatedAt = new Date().toISOString();
  return next;
}

function setActivePitchTeam(state, teamId) {
  if (!TEAM_IDS.includes(teamId)) throw new Error('Unknown team');
  if (state.phase !== 'pitch') throw new Error('Pitch mode is not active');
  const next = clone(state);
  next.activePitchTeam = teamId;
  next.updatedAt = new Date().toISOString();
  return next;
}

function validViewer(state, viewer) {
  return TEAM_IDS.includes(viewer.teamId)
    && Boolean(viewer.deviceId)
    && state.teams[viewer.teamId].deviceId === viewer.deviceId;
}

function publicState(state, viewer = {}) {
  const scoped = validViewer(state, viewer);
  const pitchTeam = state.phase === 'pitch' ? state.activePitchTeam : null;
  return {
    roomId: state.roomId,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt,
    roundEndsAt: state.roundEndsAt,
    activePitchTeam: state.activePitchTeam,
    updatedAt: state.updatedAt,
    teams: Object.fromEntries(TEAM_IDS.map((id) => {
      const team = state.teams[id];
      const safe = {
        id: team.id,
        label: team.teamName || team.label,
        teamName: team.teamName || null,
        joined: team.joined,
        submittedRound1: Boolean(team.round1),
        submittedRound2: Boolean(team.round2),
      };
      if ((scoped && id === viewer.teamId) || (!viewer.spectator && id === pitchTeam)) {
        safe.companyId = team.companyId;
        safe.round1 = clone(team.round1);
        safe.round2 = clone(team.round2);
      }
      return [id, safe];
    })),
  };
}

module.exports = {
  ACCESS_CODE_ALPHABET,
  ACTIONS,
  BASE_EVIDENCE_IDS,
  COMPANY_IDS,
  EVIDENCE_IDS,
  NEW_EVIDENCE_IDS,
  PHASES,
  RISK_IDS,
  ROUND_DURATION_MS,
  STAGES,
  TEAM_IDS,
  createInitialState,
  joinByCode,
  publicState,
  setActivePitchTeam,
  submitRound,
  transitionPhase,
};
