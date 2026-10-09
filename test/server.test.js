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

test('GET /api/state returns public state without answers', async () => {
  await withServer(async (base) => {
    const body = await (await fetch(`${base}/api/state`)).json();
    assert.equal(body.phase, 'lobby');
    assert.equal(body.teams.startup.round1, undefined);
  });
});

test('host transition requires valid host key', async () => {
  await withServer(async (base) => {
    const denied = await fetch(`${base}/api/host/phase`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phase: 'round1' }) });
    assert.equal(denied.status, 401);
    const allowed = await fetch(`${base}/api/host/phase`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': 'test-key' }, body: JSON.stringify({ phase: 'round1' }) });
    assert.equal(allowed.status, 200);
  });
});

test('team can join and submit with matching token', async () => {
  await withServer(async (base) => {
    const hostState = await (await fetch(`${base}/api/host/state`, { headers: { 'x-host-key': 'test-key' } })).json();
    const token = hostState.teams.startup.accessToken;
    const headers = { 'content-type': 'application/json', 'x-team-token': token };
    assert.equal((await fetch(`${base}/api/teams/startup/join`, { method: 'POST', headers, body: JSON.stringify({ displayName: 'Team Rocket' }) })).status, 200);
    await fetch(`${base}/api/host/phase`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-host-key': 'test-key' }, body: JSON.stringify({ phase: 'round1' }) });
    const submit = await fetch(`${base}/api/teams/startup/submissions/1`, { method: 'POST', headers, body: JSON.stringify({ stage: 'peak', action: 'pilot', evidence: ['company_volume', 'fast_resolution', 'company_reported'], reason: 'ทดลองก่อนเพราะเป็นข้อมูลบริษัท', kpi: 'customer_satisfaction', confidence: 4 }) });
    assert.equal(submit.status, 200);
    assert.equal((await submit.json()).teams.startup.round1.action, 'pilot');
  });
});

test('player and host pages are served', async () => {
  await withServer(async (base) => {
    assert.match(await (await fetch(`${base}/`)).text(), /Hype Cycle Decision Room/);
    assert.match(await (await fetch(`${base}/host`)).text(), /Facilitator Control/);
  });
});

test('unknown API route returns JSON 404', async () => {
  await withServer(async (base) => {
    const response = await fetch(`${base}/api/nope`);
    assert.equal(response.status, 404);
  });
});
