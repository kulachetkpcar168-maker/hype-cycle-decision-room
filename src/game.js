const crypto = require('node:crypto');

const PHASES = [
  'lobby',
  'round1',
  'round1_locked',
  'twist',
  'round2',
  'round2_locked',
  'pitch',
  'debrief',
];

const TEAM_IDS = ['startup', 'sme', 'corporate'];
const STAGES = ['innovation', 'peak', 'trough', 'slope', 'plateau'];
const ACTIONS = ['invest', 'pilot', 'wait', 'stop'];
const EVIDENCE_IDS = [
  'company_volume', 'two_thirds', 'fte_equivalent', 'fast_resolution',
  'repeat_drop', 'languages', 'profit_projection', 'company_reported',
];
const KPIS = [
  'cost_per_conversation',
  'resolution_time',
  'first_contact_resolution',
  'repeat_inquiry_rate',
  'customer_satisfaction',
  'escalation_rate',
  'complaint_rate',
  'revenue_impact',
];

function createInitialState() {
  return {
    roomId: crypto.randomBytes(12).toString('base64url'),
    phase: 'lobby',
    activePitchTeam: 'startup',
    updatedAt: new Date().toISOString(),
    teams: Object.fromEntries(
      TEAM_IDS.map((id) => [
        id,
        {
          id,
          accessToken: crypto.randomBytes(6).toString('base64url'),
          joined: false,
          displayName: '',
          round1: null,
          round2: null,
        },
      ])
    ),
  };
}

function clone(value) {
  return structuredClone(value);
}

function transitionPhase(state, nextPhase) {
  const currentIndex = PHASES.indexOf(state.phase);
  const nextIndex = PHASES.indexOf(nextPhase);
  if (currentIndex === -1 || nextIndex !== currentIndex + 1) {
    throw new Error(`Invalid phase transition: ${state.phase} -> ${nextPhase}`);
  }
  const next = clone(state);
  next.phase = nextPhase;
  next.updatedAt = new Date().toISOString();
  return next;
}

function validateSubmission(round, payload) {
  const allowedFields = new Set(['stage', 'action', 'evidence', 'reason', 'kpi', 'confidence']);
  if (round === 2) allowedFields.add('changedBy');
  const unknownField = Object.keys(payload).find((field) => !allowedFields.has(field));
  if (unknownField) throw new Error(`Unknown submission field: ${unknownField}`);
  if (!STAGES.includes(payload.stage)) throw new Error('Invalid stage');
  if (!ACTIONS.includes(payload.action)) throw new Error('Invalid action');
  if (!KPIS.includes(payload.kpi)) throw new Error('Invalid KPI');
  if (!Number.isInteger(payload.confidence) || payload.confidence < 1 || payload.confidence > 5) {
    throw new Error('Confidence must be an integer from 1 to 5');
  }
  if (!Array.isArray(payload.evidence) || payload.evidence.length !== 3 || new Set(payload.evidence).size !== 3) {
    throw new Error('Submission requires exactly 3 distinct evidence items');
  }
  if (payload.evidence.some((id) => !EVIDENCE_IDS.includes(id))) throw new Error('Unknown evidence item');
  if (typeof payload.reason !== 'string' || payload.reason.trim().length < 1 || payload.reason.trim().length > 200) {
    throw new Error('Reason must be 1-200 characters');
  }
  if (round === 2 && (typeof payload.changedBy !== 'string' || payload.changedBy.trim().length < 1 || payload.changedBy.trim().length > 200)) {
    throw new Error('Round 2 requires changedBy explanation of 1-200 characters');
  }
}

function submitRound(state, teamId, round, payload) {
  if (!TEAM_IDS.includes(teamId)) throw new Error('Unknown team');
  if (![1, 2].includes(round)) throw new Error('Unknown round');
  if (round === 1 && state.phase !== 'round1') throw new Error('Round 1 is not open');
  if (round === 2 && state.phase !== 'round2') throw new Error('Round 2 is not open');
  if (!state.teams[teamId].joined) throw new Error('Team must join before submitting');
  if (round === 2 && !state.teams[teamId].round1) throw new Error('Round 1 answer is required before Round 2');
  validateSubmission(round, payload);

  const next = clone(state);
  next.teams[teamId][`round${round}`] = {
    stage: payload.stage,
    action: payload.action,
    evidence: [...payload.evidence],
    reason: payload.reason.trim(),
    kpi: payload.kpi,
    confidence: payload.confidence,
    changedBy: round === 2 ? payload.changedBy.trim() : undefined,
    submittedAt: new Date().toISOString(),
  };
  next.updatedAt = new Date().toISOString();
  return next;
}

function joinTeam(state, teamId, displayName) {
  if (!TEAM_IDS.includes(teamId)) throw new Error('Unknown team');
  if (state.phase !== 'lobby') throw new Error('Teams can join only during lobby');
  if (typeof displayName !== 'string' || displayName.trim().length < 1 || displayName.trim().length > 40) {
    throw new Error('Team name must be 1-40 characters');
  }
  const next = clone(state);
  next.teams[teamId].joined = true;
  next.teams[teamId].displayName = displayName.trim();
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

function publicState(state, viewer = {}) {
  const validViewer = TEAM_IDS.includes(viewer.teamId)
    && state.teams[viewer.teamId].accessToken === viewer.teamToken;
  return {
    phase: state.phase,
    activePitchTeam: state.activePitchTeam,
    updatedAt: state.updatedAt,
    teams: Object.fromEntries(TEAM_IDS.map((id) => {
      const team = state.teams[id];
      const safe = {
        id: team.id,
        joined: team.joined,
        displayName: team.displayName,
        submittedRound1: Boolean(team.round1),
        submittedRound2: Boolean(team.round2),
      };
      if (validViewer && id === viewer.teamId) {
        safe.round1 = clone(team.round1);
        safe.round2 = clone(team.round2);
      }
      return [id, safe];
    })),
  };
}

module.exports = {
  ACTIONS,
  EVIDENCE_IDS,
  KPIS,
  PHASES,
  STAGES,
  TEAM_IDS,
  createInitialState,
  joinTeam,
  publicState,
  setActivePitchTeam,
  submitRound,
  transitionPhase,
};
