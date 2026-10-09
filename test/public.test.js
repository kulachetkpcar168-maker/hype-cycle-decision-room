const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('player UI explains rules before join and accepts a four-character code without team selection', () => {
  const player = read('public/player.js');
  assert.match(player, /กติกา/);
  assert.match(player, /20 นาที/);
  assert.match(player, /maxlength="4"/);
  assert.match(player, /\/api\/join/);
  assert.doesNotMatch(player, /data-team=/);
  assert.match(player, /localStorage\.setItem\('hype-team-code'/);
  assert.match(player, /localStorage\.setItem\('hype-device-id'/);
});

test('player UI has synchronized warning timer, dedicated submitted state, and explicit edit action', () => {
  const player = read('public/player.js');
  assert.match(player, /roundEndsAt/);
  assert.match(player, /warning/);
  assert.match(player, /ส่งคำตอบแล้ว/);
  assert.match(player, /แก้ไขคำตอบ/);
  assert.doesNotMatch(player, /confidence|changedBy|reason|kpi/i);
  assert.doesNotMatch(player, /type="checkbox"/);
});

test('round two includes round one answer and new information on one page without duplicating new evidence cards', () => {
  const player = read('public/player.js');
  assert.match(player, /คำตอบ Round 1 ของทีม/);
  assert.match(player, /ข้อมูลใหม่/);
  assert.match(player, /evidenceCards\(C\.evidence\)/);
});

test('host UI labels teams generically, hides companies outside selected pitch, and gives phase feedback', () => {
  const host = read('public/host.js');
  assert.match(host, /Team A/);
  assert.match(host, /phase-hero/);
  assert.match(host, /เปลี่ยน Phase แล้ว/);
  assert.match(host, /activePitchTeam/);
  assert.doesNotMatch(host, /winner|leaderboard|score|ranking|vote/i);
});

test('host reveal phase compares every team before and after without exposing company identities', () => {
  const host = read('public/host.js');
  assert.match(host, /revealGrid/);
  assert.match(host, /Before/);
  assert.match(host, /After/);
  assert.match(host, /state\.phase === 'reveal'/);
});

test('content includes full company fact sheets, schedule, risks, and exact takeaway', () => {
  const common = read('public/common.js');
  for (const field of ['operation', 'customerVolume', 'staffingWorkflow', 'constraints', 'riskTolerance', 'decisionQuestion']) assert.match(common, new RegExp(field));
  assert.match(common, /rules: 2/);
  assert.match(common, /pitches: 6/);
  assert.match(common, /Same technology\. Same evidence\. Different context\. Different action\./);
  assert.match(common, /strategic judgment/i);
});

test('projected dashboard CSS supports large phase, code, timer, and mobile player layouts', () => {
  const css = read('public/styles.css');
  assert.match(css, /\.phase-hero/);
  assert.match(css, /\.timer\.warning/);
  assert.match(css, /\.access-code/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
});
