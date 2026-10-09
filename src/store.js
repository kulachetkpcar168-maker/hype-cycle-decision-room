const fs = require('node:fs');
const path = require('node:path');
const { createInitialState, TEAM_IDS } = require('./game');

function serializeStateFields(state) {
  return {
    roomId: state.roomId,
    phase: state.phase,
    activePitchTeam: state.activePitchTeam,
    updatedAt: state.updatedAt,
    ...Object.fromEntries(TEAM_IDS.map((id) => [id, JSON.stringify(state.teams[id])])),
  };
}

function deserializeRedisHash(value) {
  const fields = Array.isArray(value)
    ? Object.fromEntries(Array.from({ length: value.length / 2 }, (_, index) => [value[index * 2], value[index * 2 + 1]]))
    : (value || {});
  if (!fields.phase) return null;
  const initial = createInitialState();
  return {
    roomId: fields.roomId || initial.roomId,
    phase: fields.phase,
    activePitchTeam: fields.activePitchTeam || initial.activePitchTeam,
    updatedAt: fields.updatedAt || initial.updatedAt,
    teams: Object.fromEntries(
      TEAM_IDS.map((id) => {
        try {
          return [id, fields[id] ? JSON.parse(fields[id]) : initial.teams[id]];
        } catch {
          return [id, initial.teams[id]];
        }
      })
    ),
  };
}

function phaseError(requiredPhase) {
  return `${requiredPhase === 'round1' ? 'Round 1' : 'Round 2'} is not open`;
}

function createFileStore(storagePath) {
  let state;
  const rateLimits = new Map();

  function read() {
    if (state) return structuredClone(state);
    try {
      state = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
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
      const next = read();
      next.teams[teamId] = structuredClone(team);
      next.updatedAt = updatedAt;
      write(next);
    },
    async saveTeamIfPhase(teamId, team, updatedAt, requiredPhase) {
      const next = read();
      if (next.phase !== requiredPhase) throw new Error(phaseError(requiredPhase));
      next.teams[teamId] = structuredClone(team);
      next.updatedAt = updatedAt;
      write(next);
    },
    async saveTeamIfAccess(teamId, team, updatedAt, expectedToken, requiredPhase = '') {
      const next = read();
      if (!expectedToken || next.teams[teamId]?.accessToken !== expectedToken) throw new Error('Invalid team access code');
      if (requiredPhase && next.phase !== requiredPhase) throw new Error(phaseError(requiredPhase));
      next.teams[teamId] = structuredClone(team);
      next.updatedAt = updatedAt;
      write(next);
    },
    async transitionPhase(expectedPhase, expectedRoomId, nextPhase, updatedAt) {
      const next = read();
      if (next.phase !== expectedPhase || next.roomId !== expectedRoomId) {
        throw new Error('Game state changed; refresh and retry');
      }
      next.phase = nextPhase;
      next.updatedAt = updatedAt;
      write(next);
    },
    async setActivePitchTeam(expectedRoomId, expectedPhase, teamId, updatedAt) {
      const next = read();
      if (next.roomId !== expectedRoomId || next.phase !== expectedPhase) {
        throw new Error('Game state changed; refresh and retry');
      }
      next.activePitchTeam = teamId;
      next.updatedAt = updatedAt;
      write(next);
    },
    async saveMeta(meta) {
      const next = read();
      Object.assign(next, meta);
      write(next);
    },
    async consumeRateLimit(client, limit, windowMs) {
      const now = Date.now();
      const record = rateLimits.get(client);
      if (!record || now >= record.expiresAt) {
        rateLimits.set(client, { count: 1, expiresAt: now + windowMs });
        return true;
      }
      record.count += 1;
      return record.count <= limit;
    },
    async reset(nextState = createInitialState()) { write(nextState); },
  };
}

function createUpstashStore(options = {}) {
  const url = options.url || process.env.UPSTASH_REDIS_REST_URL;
  const token = options.token || process.env.UPSTASH_REDIS_REST_TOKEN;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const key = options.key || process.env.GAME_STATE_KEY || 'hype-cycle:decision-room';
  if (!url || !token) throw new Error('Missing Upstash Redis credentials');

  async function command(parts) {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(parts),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error(payload.error || `Upstash request failed: ${response.status}`);
    return payload.result;
  }

  async function reset(nextState = createInitialState()) {
    const fields = serializeStateFields(nextState);
    const args = ['HSET', key];
    for (const [field, value] of Object.entries(fields)) args.push(field, value);
    await command(args);
  }

  async function saveTeamIfAccess(teamId, team, updatedAt, expectedToken, requiredPhase = '') {
    const script = "local raw=redis.call('HGET',KEYS[1],ARGV[2]); if not raw then return redis.error_reply('INVALID_TOKEN') end; local current=cjson.decode(raw); if current.accessToken~=ARGV[1] then return redis.error_reply('INVALID_TOKEN') end; if ARGV[5]~='' and redis.call('HGET',KEYS[1],'phase')~=ARGV[5] then return redis.error_reply('PHASE_LOCKED') end; redis.call('HSET',KEYS[1],ARGV[2],ARGV[3],'updatedAt',ARGV[4]); return 1";
    try {
      await command(['EVAL', script, '1', key, expectedToken, teamId, JSON.stringify(team), updatedAt, requiredPhase]);
    } catch (error) {
      if (error.message.includes('INVALID_TOKEN')) throw new Error('Invalid team access code');
      if (error.message.includes('PHASE_LOCKED')) throw new Error(phaseError(requiredPhase));
      throw error;
    }
  }

  return {
    async load() {
      const initial = createInitialState();
      const fields = Object.entries(serializeStateFields(initial)).flat();
      const script = "if redis.call('EXISTS',KEYS[1])==0 then redis.call('HSET',KEYS[1],unpack(ARGV)) end; return redis.call('HGETALL',KEYS[1])";
      return deserializeRedisHash(await command(['EVAL', script, '1', key, ...fields]));
    },
    async saveTeam(teamId, team, updatedAt) {
      await command(['HSET', key, teamId, JSON.stringify(team), 'updatedAt', updatedAt]);
    },
    async saveTeamIfPhase(teamId, team, updatedAt, requiredPhase) {
      const script = "local p=redis.call('HGET',KEYS[1],'phase'); if p~=ARGV[1] then return redis.error_reply('PHASE_LOCKED') end; redis.call('HSET',KEYS[1],ARGV[2],ARGV[3],'updatedAt',ARGV[4]); return 1";
      try {
        await command(['EVAL', script, '1', key, requiredPhase, teamId, JSON.stringify(team), updatedAt]);
      } catch (error) {
        if (error.message.includes('PHASE_LOCKED')) throw new Error(phaseError(requiredPhase));
        throw error;
      }
    },
    saveTeamIfAccess,
    async transitionPhase(expectedPhase, expectedRoomId, nextPhase, updatedAt) {
      const script = "if redis.call('HGET',KEYS[1],'phase')~=ARGV[1] or redis.call('HGET',KEYS[1],'roomId')~=ARGV[2] then return redis.error_reply('STATE_CHANGED') end; redis.call('HSET',KEYS[1],'phase',ARGV[3],'updatedAt',ARGV[4]); return 1";
      try {
        await command(['EVAL', script, '1', key, expectedPhase, expectedRoomId, nextPhase, updatedAt]);
      } catch (error) {
        if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry');
        throw error;
      }
    },
    async setActivePitchTeam(expectedRoomId, expectedPhase, teamId, updatedAt) {
      const script = "if redis.call('HGET',KEYS[1],'roomId')~=ARGV[1] or redis.call('HGET',KEYS[1],'phase')~=ARGV[2] then return redis.error_reply('STATE_CHANGED') end; redis.call('HSET',KEYS[1],'activePitchTeam',ARGV[3],'updatedAt',ARGV[4]); return 1";
      try {
        await command(['EVAL', script, '1', key, expectedRoomId, expectedPhase, teamId, updatedAt]);
      } catch (error) {
        if (error.message.includes('STATE_CHANGED')) throw new Error('Game state changed; refresh and retry');
        throw error;
      }
    },
    async saveMeta(meta) {
      const args = ['HSET', key];
      for (const [field, value] of Object.entries(meta)) args.push(field, value);
      await command(args);
    },
    async consumeRateLimit(client, limit, windowMs) {
      const rateKey = `${key}:rate:${client}`;
      const script = "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[2]) end; if count>tonumber(ARGV[1]) then return 0 end; return 1";
      return Number(await command(['EVAL', script, '1', rateKey, String(limit), String(windowMs)])) === 1;
    },
    reset,
  };
}

module.exports = {
  createFileStore,
  createUpstashStore,
  deserializeRedisHash,
  serializeStateFields,
};
