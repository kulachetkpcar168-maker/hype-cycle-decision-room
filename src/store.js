const fs = require('node:fs');
const path = require('node:path');
const { createInitialState, TEAM_IDS } = require('./game');

function serializeStateFields(state) {
  return {
    schemaVersion: String(state.schemaVersion || 3),
    roomId: state.roomId,
    phase: state.phase,
    phaseStartedAt: state.phaseStartedAt || '',
    roundEndsAt: state.roundEndsAt || '',
    activePitchTeam: state.activePitchTeam,
    updatedAt: state.updatedAt,
    ...Object.fromEntries(TEAM_IDS.map((id) => [id, JSON.stringify(state.teams[id])])),
  };
}

function deserializeRedisHash(value) {
  const fields = Array.isArray(value)
    ? Object.fromEntries(Array.from({ length: value.length / 2 }, (_, index) => [value[index * 2], value[index * 2 + 1]]))
    : (value || {});
  if (fields.schemaVersion !== '3' || !fields.roomId || !fields.phase) return null;
  const teams = {};
  for (const id of TEAM_IDS) {
    if (!fields[id]) return null;
    try {
      const team = JSON.parse(fields[id]);
      if (!team || team.id !== id || !team.accessCode || !team.companyId || !Object.hasOwn(team, 'teamName')) return null;
      teams[id] = team;
    } catch {
      return null;
    }
  }
  return {
    schemaVersion: 3,
    roomId: fields.roomId,
    phase: fields.phase,
    phaseStartedAt: fields.phaseStartedAt || null,
    roundEndsAt: fields.roundEndsAt || null,
    activePitchTeam: fields.activePitchTeam || 'team-a',
    updatedAt: fields.updatedAt || new Date(0).toISOString(),
    teams,
  };
}

function phaseError(requiredPhase) {
  return `${requiredPhase === 'round1' ? 'Round 1' : 'Round 2'} is not open`;
}

function validPersistedState(value) {
  return value?.schemaVersion === 3 && TEAM_IDS.every((id) => value.teams?.[id]?.accessCode && value.teams[id].companyId && Object.hasOwn(value.teams[id], 'teamName'));
}

function createFileStore(storagePath) {
  let state;
  const rateLimits = new Map();
  function read() {
    if (state) return structuredClone(state);
    try {
      const persisted = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
      state = validPersistedState(persisted) ? persisted : createInitialState();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      state = createInitialState();
    }
    return structuredClone(state);
  }
  function write(nextState) {
    state = structuredClone(nextState);
    fs.mkdirSync(path.dirname(storagePath), { recursive: true });
    const temporaryPath = `${storagePath}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`);
    fs.renameSync(temporaryPath, storagePath);
  }
  return {
    async load() { return read(); },
    async saveTeam(teamId, team, updatedAt) {
      const next = read(); next.teams[teamId] = structuredClone(team); next.updatedAt = updatedAt; write(next);
    },
    async bindDeviceIfAvailable(teamId, expectedRoomId, expectedCode, deviceId, teamName, updateTeamName, updatedAt) {
      const next = read();
      const team = next.teams[teamId];
      if (next.roomId !== expectedRoomId) throw new Error('Game state changed; refresh and retry');
      if (!team || team.accessCode !== expectedCode) throw new Error('Invalid team access code');
      if (team.deviceId && team.deviceId !== deviceId) throw new Error('This team code is already joined on another device');
      if (!team.deviceId && next.phase !== 'lobby') throw new Error('New teams can join only during lobby');
      if (!team.deviceId || (next.phase === 'lobby' && updateTeamName)) team.teamName = teamName;
      team.deviceId = deviceId; team.joined = true; next.updatedAt = updatedAt; write(next);
    },
    async saveTeamIfDevice(teamId, team, updatedAt, expectedRoomId, expectedCode, expectedDeviceId, requiredPhase) {
      const next = read();
      const current = next.teams[teamId];
      if (next.roomId !== expectedRoomId) throw new Error('Game state changed; refresh and retry');
      if (!current || current.accessCode !== String(expectedCode).toUpperCase() || current.deviceId !== expectedDeviceId) throw new Error('Invalid team credentials');
      if (next.phase !== requiredPhase) throw new Error(phaseError(requiredPhase));
      next.teams[teamId] = structuredClone(team); next.updatedAt = updatedAt; write(next);
    },
    async transitionPhase(expectedPhase, expectedRoomId, phaseUpdate, legacyUpdatedAt) {
      const next = read();
      if (next.phase !== expectedPhase || next.roomId !== expectedRoomId) throw new Error('Game state changed; refresh and retry');
      const update = typeof phaseUpdate === 'string' ? { phase: phaseUpdate, phaseStartedAt: legacyUpdatedAt, roundEndsAt: null, updatedAt: legacyUpdatedAt } : phaseUpdate;
      Object.assign(next, update); write(next);
    },
    async setActivePitchTeam(expectedRoomId, expectedPhase, teamId, updatedAt) {
      const next = read();
      if (next.roomId !== expectedRoomId || next.phase !== expectedPhase) throw new Error('Game state changed; refresh and retry');
      next.activePitchTeam = teamId; next.updatedAt = updatedAt; write(next);
    },
    async consumeRateLimit(client, limit, windowMs) {
      const now = Date.now(); const record = rateLimits.get(client);
      if (!record || now >= record.expiresAt) { rateLimits.set(client, { count: 1, expiresAt: now + windowMs }); return true; }
      record.count += 1; return record.count <= limit;
    },
    async reset(nextState = createInitialState()) { write(nextState); },
  };
}

function createUpstashStore(options = {}) {
  const url = options.url || process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = options.token || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const key = options.key || process.env.GAME_STATE_KEY || 'hype-cycle:decision-room';
  if (!url || !token) throw new Error('Missing Upstash Redis credentials');
  async function command(parts) {
    const response = await fetchImpl(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(parts) });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || `Upstash request failed: ${response.status}`);
    return payload.result;
  }
  async function reset(nextState = createInitialState()) {
    const args = ['HSET', key];
    for (const [field, value] of Object.entries(serializeStateFields(nextState))) args.push(field, value);
    await command(args);
  }
  return {
    async load() {
      const initial = createInitialState();
      const fields = Object.entries(serializeStateFields(initial)).flat();
      const script = "local valid=redis.call('EXISTS',KEYS[1])==1 and redis.call('HGET',KEYS[1],'schemaVersion')==ARGV[2]; local ids={'team-a','team-b','team-c'}; if valid then for _,id in ipairs(ids) do local raw=redis.call('HGET',KEYS[1],id); if not raw then valid=false; break end; local ok,team=pcall(cjson.decode,raw); if not ok or type(team)~='table' or type(team.id)~='string' or team.id~=id or type(team.accessCode)~='string' or team.accessCode=='' or type(team.companyId)~='string' or team.companyId=='' or team.teamName==nil then valid=false; break end end end; if not valid then redis.call('DEL',KEYS[1]); redis.call('HSET',KEYS[1],unpack(ARGV)) end; return redis.call('HGETALL',KEYS[1])";
      const state = deserializeRedisHash(await command(['EVAL', script, '1', key, ...fields]));
      return validPersistedState(state) ? state : initial;
    },
    async saveTeam(teamId, team, updatedAt) { await command(['HSET', key, teamId, JSON.stringify(team), 'updatedAt', updatedAt]); },
    async bindDeviceIfAvailable(teamId, expectedRoomId, expectedCode, deviceId, teamName, updateTeamName, updatedAt) {
      const script = "if redis.call('HGET',KEYS[1],'roomId')~=ARGV[1] then return redis.error_reply('STATE_CHANGED') end; local raw=redis.call('HGET',KEYS[1],ARGV[2]); if not raw then return redis.error_reply('INVALID_CODE') end; local team=cjson.decode(raw); if team.accessCode~=ARGV[3] then return redis.error_reply('INVALID_CODE') end; local phase=redis.call('HGET',KEYS[1],'phase'); if team.deviceId and team.deviceId~=cjson.null and team.deviceId~=ARGV[4] then return redis.error_reply('DEVICE_TAKEN') end; if (not team.deviceId or team.deviceId==cjson.null) and phase~='lobby' then return redis.error_reply('LOBBY_CLOSED') end; if not team.deviceId or team.deviceId==cjson.null or (phase=='lobby' and ARGV[6]=='1') then team.teamName=ARGV[5] end; team.deviceId=ARGV[4]; team.joined=true; redis.call('HSET',KEYS[1],ARGV[2],cjson.encode(team),'updatedAt',ARGV[7]); return 1";
      try { await command(['EVAL', script, '1', key, expectedRoomId, teamId, expectedCode, deviceId, teamName, updateTeamName ? '1' : '0', updatedAt]); }
      catch (error) {
        if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry');
        if (error.message.includes('INVALID_CODE')) throw new Error('Invalid team access code');
        if (error.message.includes('DEVICE_TAKEN')) throw new Error('This team code is already joined on another device');
        if (error.message.includes('LOBBY_CLOSED')) throw new Error('New teams can join only during lobby');
        throw error;
      }
    },
    async saveTeamIfDevice(teamId, team, updatedAt, expectedRoomId, expectedCode, expectedDeviceId, requiredPhase) {
      const script = "if redis.call('HGET',KEYS[1],'roomId')~=ARGV[1] then return redis.error_reply('STATE_CHANGED') end; local raw=redis.call('HGET',KEYS[1],ARGV[2]); if not raw then return redis.error_reply('INVALID_PLAYER') end; local current=cjson.decode(raw); if current.accessCode~=ARGV[3] or current.deviceId~=ARGV[4] then return redis.error_reply('INVALID_PLAYER') end; if redis.call('HGET',KEYS[1],'phase')~=ARGV[5] then return redis.error_reply('PHASE_LOCKED') end; redis.call('HSET',KEYS[1],ARGV[2],ARGV[6],'updatedAt',ARGV[7]); return 1";
      try { await command(['EVAL', script, '1', key, expectedRoomId, teamId, String(expectedCode).toUpperCase(), expectedDeviceId, requiredPhase, JSON.stringify(team), updatedAt]); }
      catch (error) {
        if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry');
        if (error.message.includes('INVALID_PLAYER')) throw new Error('Invalid team credentials');
        if (error.message.includes('PHASE_LOCKED')) throw new Error(phaseError(requiredPhase));
        throw error;
      }
    },
    async transitionPhase(expectedPhase, expectedRoomId, phaseUpdate, legacyUpdatedAt) {
      const update = typeof phaseUpdate === 'string' ? { phase: phaseUpdate, phaseStartedAt: legacyUpdatedAt || '', roundEndsAt: '', updatedAt: legacyUpdatedAt } : phaseUpdate;
      const script = "if redis.call('HGET',KEYS[1],'phase')~=ARGV[1] or redis.call('HGET',KEYS[1],'roomId')~=ARGV[2] then return redis.error_reply('STATE_CHANGED') end; redis.call('HSET',KEYS[1],'phase',ARGV[3],'phaseStartedAt',ARGV[4],'roundEndsAt',ARGV[5],'updatedAt',ARGV[6]); return 1";
      try { await command(['EVAL', script, '1', key, expectedPhase, expectedRoomId, update.phase, update.phaseStartedAt || '', update.roundEndsAt || '', update.updatedAt]); }
      catch (error) { if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry'); throw error; }
    },
    async setActivePitchTeam(expectedRoomId, expectedPhase, teamId, updatedAt) {
      const script = "if redis.call('HGET',KEYS[1],'roomId')~=ARGV[1] or redis.call('HGET',KEYS[1],'phase')~=ARGV[2] then return redis.error_reply('STATE_CHANGED') end; redis.call('HSET',KEYS[1],'activePitchTeam',ARGV[3],'updatedAt',ARGV[4]); return 1";
      try { await command(['EVAL', script, '1', key, expectedRoomId, expectedPhase, teamId, updatedAt]); }
      catch (error) { if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry'); throw error; }
    },
    async consumeRateLimit(client, limit, windowMs) {
      const rateKey = `${key}:rate:${client}`;
      const script = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; if count>tonumber(ARGV[1]) then return 0 end; return 1";
      return Number(await command(['EVAL', script, '1', rateKey, String(limit), String(windowMs)])) === 1;
    },
    reset,
  };
}

module.exports = { createFileStore, createUpstashStore, deserializeRedisHash, serializeStateFields };
