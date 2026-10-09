const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppServer } = require('../src/server');

async function withServer(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-cycle-'));
  const server = createAppServer({ storagePath: path.join(dir, 'state.json'), hostKey: 'test-key' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
}

async function withConfiguredServer(options, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hype-cycle-policy-'));
  const server = createAppServer({ storagePath: path.join(dir, 'state.json'), hostKey: 'test-key', ...options });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); }
}

const hostHeaders = { 'content-type': 'application/json', 'x-host-key': 'test-key' };

test('end-to-end player joins by code and submits the simplified decision', async () => {
  await withServer(async (base) => {
    const host = await (await fetch(`${base}/api/host/state`, { headers: { 'x-host-key': 'test-key' } })).json();
    const teamId = 'team-a';
    const code = host.teams[teamId].accessCode;
    const deviceId = 'device-browser-1234';
    const join = await fetch(`${base}/api/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, deviceId, teamName: 'ทีม Browser' }) });
    assert.equal(join.status, 200);
    assert.equal((await join.json()).teamId, teamId);
    await fetch(`${base}/api/host/phase`, { method: 'POST', headers: hostHeaders, body: JSON.stringify({ phase: 'round1' }) });
    const submit = await fetch(`${base}/api/teams/${teamId}/submissions/1`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-team-id': teamId, 'x-team-code': code, 'x-device-id': deviceId },
      body: JSON.stringify({ stage: 'peak', action: 'pilot', mostInfluentialEvidence: 'fast_resolution', mainRisk: 'service_quality' }),
    });
    assert.equal(submit.status, 200);
    assert.equal((await submit.json()).teams[teamId].round1.action, 'pilot');
  });
});

test('public state and static pages are served safely', async () => {
  await withServer(async (base) => {
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.teams['team-a'].companyId, undefined);
    assert.match(await (await fetch(`${base}/`)).text(), /Hype Cycle Decision Room/);
    assert.match(await (await fetch(`${base}/host`)).text(), /Facilitator Control/);
    assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  });
});

test('local server uses separate read and write request buckets', async () => {
  await withConfiguredServer({ readRateLimit: 2, writeRateLimit: 1 }, async (base) => {
    assert.equal((await fetch(`${base}/api/state`)).status, 200);
    assert.equal((await fetch(`${base}/api/state`)).status, 200);
    assert.equal((await fetch(`${base}/api/state`)).status, 429);
    assert.equal((await fetch(`${base}/api/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 400);
    assert.equal((await fetch(`${base}/api/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 429);
    assert.equal((await fetch(`${base}/api/host/state`, { headers: { 'x-host-key': 'test-key' } })).status, 200);
  });
});

test('local rate limiting ignores spoofed forwarded headers', async () => {
  await withConfiguredServer({ readRateLimit: 1 }, async (base) => {
    assert.equal((await fetch(`${base}/api/state`, { headers: { 'x-forwarded-for': 'forged-a' } })).status, 200);
    assert.equal((await fetch(`${base}/api/state`, { headers: { 'x-forwarded-for': 'forged-b' } })).status, 429);
  });
});
