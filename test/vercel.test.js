const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createVercelHandler } = require('../src/vercel');
const { createFileStore } = require('../src/store');

function mockResponse() {
  return { statusCode: 0, headers: {}, payload: null, status(code) { this.statusCode = code; return this; }, setHeader(name, value) { this.headers[name] = value; }, json(value) { this.payload = value; return this; } };
}

test('vercel handler rejects missing host configuration', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  assert.throws(() => createVercelHandler({ store: createFileStore(path.join(dir, 'state.json')), hostKey: '' }), /HOST_KEY/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel handler maps catch-all route to shared API', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const handler = createVercelHandler({ store: createFileStore(path.join(dir, 'state.json')), hostKey: 'key' });
  const res = mockResponse();
  await handler({ method: 'GET', url: '/api/state', query: {}, headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.phase, 'lobby');
  assert.equal(res.headers['Cache-Control'], 'no-store');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel handler returns 400 for malformed JSON string body', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const handler = createVercelHandler({ store: createFileStore(path.join(dir, 'state.json')), hostKey: 'key' });
  const res = mockResponse();
  await handler({ method: 'POST', query: { route: ['teams', 'startup', 'join'] }, headers: {}, body: '{bad' }, res);
  assert.equal(res.statusCode, 400);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel handler returns 400 when the runtime body getter throws', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const handler = createVercelHandler({ store: createFileStore(path.join(dir, 'state.json')), hostKey: 'key' });
  const request = { method: 'POST', query: { route: ['teams', 'startup', 'join'] }, headers: {} };
  Object.defineProperty(request, 'body', { get() { throw new SyntaxError('Malformed JSON'); } });
  const res = mockResponse();
  await handler(request, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.error, 'Invalid JSON');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel handler rejects oversized request bodies', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const handler = createVercelHandler({ store: createFileStore(path.join(dir, 'state.json')), hostKey: 'key', maxBodyBytes: 1024 });
  const res = mockResponse();
  await handler({ method: 'POST', query: { route: ['teams', 'startup', 'join'] }, headers: {}, body: { displayName: 'x'.repeat(2000) } }, res);
  assert.equal(res.statusCode, 413);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel handlers share store-backed limits and prefer vercel client IP', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const first = createVercelHandler({ store, hostKey: 'key', rateLimit: 1 });
  const second = createVercelHandler({ store, hostKey: 'key', rateLimit: 1 });
  const request = (handler, headers) => {
    const res = mockResponse();
    return handler({ method: 'GET', query: { route: ['state'] }, headers, body: {} }, res).then(() => res.statusCode);
  };
  assert.equal(await request(first, { 'x-vercel-forwarded-for': 'edge-a', 'x-forwarded-for': 'proxy' }), 200);
  assert.equal(await request(second, { 'x-vercel-forwarded-for': 'edge-b', 'x-forwarded-for': 'proxy' }), 200);
  assert.equal(await request(second, { 'x-vercel-forwarded-for': 'edge-a', 'x-forwarded-for': 'other' }), 429);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('vercel limiter falls back to x-forwarded-for', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-vercel-'));
  const store = createFileStore(path.join(dir, 'state.json'));
  const handler = createVercelHandler({ store, hostKey: 'key', rateLimit: 1 });
  const call = async () => { const res = mockResponse(); await handler({ method: 'GET', query: { route: ['state'] }, headers: { 'x-forwarded-for': 'local, proxy' }, body: {} }, res); return res.statusCode; };
  assert.equal(await call(), 200);
  assert.equal(await call(), 429);
  fs.rmSync(dir, { recursive: true, force: true });
});
