const test = require('node:test');
const assert = require('node:assert/strict');
const { createVisibilityPoller } = require('../public/polling.js');

function harness({ hidden = false, delay = () => 1500 } = {}) {
  let listener;
  let nextId = 0;
  const timers = new Map();
  const document = {
    hidden,
    addEventListener(type, callback) { if (type === 'visibilitychange') listener = callback; },
    removeEventListener() {},
  };
  const calls = [];
  const poller = createVisibilityPoller({
    document,
    refresh: () => calls.push('refresh'),
    delay,
    setTimeoutFn(callback, wait) { const id = ++nextId; timers.set(id, { callback, wait }); return id; },
    clearTimeoutFn(id) { timers.delete(id); },
  });
  return { calls, document, listener: () => listener(), poller, timers };
}

test('player polling uses 8 seconds anonymously and 1.5 seconds when joined', async () => {
  let joined = false;
  const h = harness({ delay: () => (joined ? 1500 : 8000) });
  h.poller.start();
  assert.equal([...h.timers.values()][0].wait, 0);
  await [...h.timers.values()][0].callback();
  assert.equal([...h.timers.values()][0].wait, 8000);
  joined = true;
  await [...h.timers.values()][0].callback();
  assert.equal([...h.timers.values()][0].wait, 1500);
});

test('polling pauses while hidden and refreshes immediately when visible', async () => {
  const h = harness({ hidden: true });
  h.poller.start();
  assert.equal(h.timers.size, 0);
  h.document.hidden = false;
  h.listener();
  assert.equal([...h.timers.values()][0].wait, 0);
  await [...h.timers.values()][0].callback();
  assert.deepEqual(h.calls, ['refresh']);
  h.document.hidden = true;
  h.listener();
  assert.equal(h.timers.size, 0);
});

test('host polling stays at 1.5 seconds', async () => {
  const h = harness({ delay: () => 1500 });
  h.poller.start();
  await [...h.timers.values()][0].callback();
  assert.equal([...h.timers.values()][0].wait, 1500);
});

test('a pending hidden-page refresh cannot replace the immediate visible refresh', async () => {
  const h = harness();
  h.poller.stop();
  let resolveRefresh;
  const poller = createVisibilityPoller({
    document: h.document,
    refresh: () => new Promise((resolve) => { resolveRefresh = resolve; }),
    delay: () => 1500,
    setTimeoutFn(callback, wait) { const id = Math.random(); h.timers.set(id, { callback, wait }); return id; },
    clearTimeoutFn(id) { h.timers.delete(id); },
  });
  poller.start();
  [...h.timers.values()][0].callback();
  h.document.hidden = true;
  h.listener();
  h.document.hidden = false;
  h.listener();
  assert.equal([...h.timers.values()][0].wait, 0);
  resolveRefresh();
  await Promise.resolve();
  assert.equal([...h.timers.values()][0].wait, 0);
});
