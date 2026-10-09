const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldRenderKeyPrompt, createRequestGuard } = require('../public/host-key-gate.js');

test('host polling keeps the existing key form mounted while the key is empty', () => {
  assert.equal(shouldRenderKeyPrompt('', true), false);
});

test('host renders the key prompt when no key and no form are present', () => {
  assert.equal(shouldRenderKeyPrompt('', false), true);
});

test('host never renders the key prompt while authenticated', () => {
  assert.equal(shouldRenderKeyPrompt('saved-key', false), false);
});

test('a delayed 401 cannot clear a newer submitted Host Key', async () => {
  const guard = createRequestGuard();
  let releaseOldRequest;
  const oldRequest = new Promise((resolve) => { releaseOldRequest = resolve; });
  const oldGeneration = guard.capture();
  let activeKey = 'new-key';

  guard.advance(); // user submitted a replacement key
  releaseOldRequest({ status: 401 });
  const response = await oldRequest;
  if (guard.isCurrent(oldGeneration) && response.status === 401) activeKey = '';

  assert.equal(activeKey, 'new-key');
});

test('a 401 from the current Host Key request remains authoritative', () => {
  const guard = createRequestGuard();
  assert.equal(guard.isCurrent(guard.capture()), true);
});
