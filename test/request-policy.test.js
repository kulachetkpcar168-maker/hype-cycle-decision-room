const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequestPolicy, hostKeysEqual, resolveApiPathname } = require('../src/request-policy');
const { createFileStore } = require('../src/store');

function memoryStore() {
  const calls = [];
  const counts = new Map();
  return {
    calls,
    async consumeRateLimit(key, limit, windowMs) {
      calls.push({ key, limit, windowMs });
      const current = counts.get(key) || 0;
      counts.set(key, current + 1);
      return current < limit;
    },
  };
}

test('host key comparison is length-safe and rejects invalid values', () => {
  assert.equal(hostKeysEqual('secret-key', 'secret-key'), true);
  assert.equal(hostKeysEqual('secret-key', 'secret-kez'), false);
  assert.equal(hostKeysEqual('secret-key', 'x'), false);
  assert.equal(hostKeysEqual('', ''), false);
  assert.equal(hostKeysEqual('secret-key', undefined), false);
});

test('rewritten Vercel route is resolved before request classification', () => {
  assert.equal(resolveApiPathname({ url: '/api?route=state', query: { route: 'state' } }), '/api/state');
  assert.equal(resolveApiPathname({ url: '/api?route=host/state', query: { route: ['host', 'state'] } }), '/api/host/state');
  assert.equal(resolveApiPathname({ url: '/api/state', query: {} }), '/api/state');
});

test('44 joined clients behind one NAT can poll for 120 seconds across fixed windows', async () => {
  const realNow = Date.now;
  let now = 0;
  Date.now = () => now;
  try {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-shared-nat-'));
    const store = createFileStore(path.join(dir, 'state.json'));
    const policy = createRequestPolicy({ store, hostKey: 'key', readLimit: 3000, writeLimit: 180 });
    let requests = 0;
    for (now = 0; now < 120_000; now += 1_500) {
      for (let client = 0; client < 44; client += 1) {
        const result = await policy.check({ method: 'GET', pathname: '/api/state', headers: {}, client: 'shared-classroom-nat' });
        assert.equal(result.allowed, true);
        assert.equal(result.bucket, 'read');
        requests += 1;
      }
    }
    assert.equal(requests, 44 * 80);
    fs.rmSync(dir, { recursive: true, force: true });
  } finally {
    Date.now = realNow;
  }
});

test('writes and invalid host requests share the write bucket', async () => {
  const store = memoryStore();
  const policy = createRequestPolicy({ store, hostKey: 'key', readLimit: 3000, writeLimit: 1 });
  assert.equal((await policy.check({ method: 'POST', pathname: '/api/join', headers: {}, client: 'classroom' })).allowed, true);
  assert.equal((await policy.check({ method: 'GET', pathname: '/api/host/state', headers: { 'x-host-key': 'wrong' }, client: 'classroom' })).allowed, false);
  assert.deepEqual(store.calls.map((call) => call.key), ['write:classroom', 'write:classroom']);
});

test('authenticated host routes bypass rate limiting', async () => {
  const store = memoryStore();
  const policy = createRequestPolicy({ store, hostKey: 'key', readLimit: 1, writeLimit: 1 });
  const result = await policy.check({ method: 'POST', pathname: '/api/host/reset', headers: { 'x-host-key': 'key' }, client: 'classroom' });
  assert.deepEqual(result, { allowed: true, authenticatedHost: true, bucket: null });
  assert.equal(store.calls.length, 0);
});
