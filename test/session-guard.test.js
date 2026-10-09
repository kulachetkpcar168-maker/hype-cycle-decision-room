const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionGuard } = require('../public/session-guard.js');

test('late invalid poll cannot clear a successful same-team rejoin', async () => {
  const guard = createSessionGuard();
  let releasePoll;
  const staleResponse = new Promise((resolve) => { releasePoll = resolve; });
  const requestSession = guard.capture();
  let joined = true;

  guard.advance(); // successful rejoin, even when teamId is unchanged
  releasePoll({ status: 401 });
  const response = await staleResponse;
  if (guard.isCurrent(requestSession) && response.status === 401) joined = false;

  assert.equal(joined, true);
});

test('invalid poll from the current session is still authoritative', () => {
  const guard = createSessionGuard();
  const requestSession = guard.capture();
  assert.equal(guard.isCurrent(requestSession), true);
});