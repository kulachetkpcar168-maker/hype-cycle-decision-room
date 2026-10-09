const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('player joins with a four-character code and validated team name', () => {
  const player = read('public/player.js');
  assert.match(player, /กติกา/); assert.match(player, /20 นาที/); assert.match(player, /maxlength="4"/);
  assert.match(player, /name="teamName"/); assert.match(player, /maxlength="40"/); assert.match(player, /\/api\/join/);
  assert.doesNotMatch(player, /data-team=/); assert.match(player, /hype-team-code/); assert.match(player, /hype-device-id/);
});

test('player has timer, submitted editing flow, and round two evidence', () => {
  const player = read('public/player.js');
  for (const token of ['roundEndsAt', 'warning', 'ส่งคำตอบแล้ว', 'แก้ไขคำตอบ', 'คำตอบ Round 1 ของทีม', 'ข้อมูลใหม่', 'evidenceCards(C.evidence)']) assert.match(player, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(player, /confidence|changedBy|reason|kpi|type="checkbox"/i);
});

test('player stage choice includes accessible inline Hype Cycle SVG and Thai explanations', () => {
  const player = read('public/player.js');
  assert.match(player, /<svg[^>]+hype-cycle-chart/); assert.match(player, /role="img"/); assert.match(player, /aria-labelledby/);
  assert.match(player, /stage-point/); assert.match(player, /stage-explanation/); assert.match(player, /addEventListener\('change'/);
  assert.match(player, /<fieldset class="field"><legend>Hype Cycle Stage<\/legend>/);
  assert.match(player, /<fieldset class="field"><legend>Action<\/legend>/);
});

test('player polling preserves an active unsent draft when another team changes state', () => {
  const player = read('public/player.js');
  assert.match(player, /formActive/); assert.match(player, /sameRoom/); assert.match(player, /samePhase/);
  assert.match(player, /ownAnswerChanged/); assert.match(player, /preserveDraft/);
});

test('player polling preserves focused lobby name and code inputs during same-room updates', () => {
  const player = read('public/player.js');
  assert.match(player, /joinFormActive/); assert.match(player, /preserveJoinEntry/);
  assert.match(player, /sameRoom/); assert.match(player, /samePhase/);
});

test('host presentation teaches all phases and shows join codes during the lobby', () => {
  const host = read('public/host.js');
  for (const token of ['lobbyPresentation', 'roundOnePresentation', 'roundTwoPresentation', 'revealGrid', 'pitchCard', 'takeawayPresentation', 'teamName', '<details class="code-vault"']) assert.match(host, new RegExp(token));
  assert.ok(host.includes("state.phase==='lobby'?'open':' '"));
  for (const token of ['2.3M', '⅔', '35+', '11→2', '−25%', '700', '$40M', 'สไลด์ก่อนหน้า', 'สไลด์ถัดไป', 'งานที่ AI ทำได้ดี', 'งานที่ยังต้องใช้คน', 'hybrid-escalation']) assert.ok(host.includes(token), token);
  assert.match(host, /เปลี่ยน Phase แล้ว/); assert.match(host, /activePitchTeam/); assert.doesNotMatch(host, /winner|leaderboard|score|ranking|vote/i);
  assert.match(host, /\/join-qr\.svg/); assert.doesNotMatch(host, /api\.qrserver\.com/);
});

test('content is Thai-first, uses unnamed simulated contexts, and labels provenance', () => {
  const common = read('public/common.js');
  for (const field of ['operation', 'customerVolume', 'staffingWorkflow', 'constraints', 'riskTolerance', 'decisionQuestion']) assert.match(common, new RegExp(field));
  for (const text of ['Klarna = กรณีศึกษาจริง', 'บริบทธุรกิจของทีม = สถานการณ์จำลอง', 'ข้อมูลจริงที่ Klarna รายงาน', 'ข้อมูลที่บริษัทรายงานเอง', 'ข้อมูลใหม่จากกรณีภายหลัง', 'บริบทธุรกิจจำลอง', 'การตีความเชิงกลยุทธ์', 'เทคโนโลยีเดียวกัน']) assert.ok(common.includes(text), text);
  assert.doesNotMatch(common, /NovaCart|SiamStay|MetroBank|Gartner.*Klarna|Klarna.*Gartner/);
});

test('audience copy avoids negative and system language', () => {
  const audience = [read('public/common.js'), read('public/player.js'), read('public/host.js')].join('\n');
  assert.doesNotMatch(audience, /ไม่มีคะแนน|ไม่มีผู้ชนะ|context hidden|company revealed/i);
});

test('CSS supports presentation, graph, timer, and responsive layouts', () => {
  const css = read('public/styles.css');
  for (const token of ['.phase-hero', '.timer.warning', '.access-code', '.hype-cycle-chart', '.stage-point', '.presentation-slide', '.hybrid-escalation', '@media(max-width:760px)']) assert.ok(css.includes(token), token);
  assert.match(css, /\.choice input:focus-visible\s*\+\s*span/);
  assert.match(css, /fieldset\.field/); assert.match(css, /legend/);
});

test('deployment guide documents the live schema-v3 architecture without invented companies', () => {
  const deployment = read('VERCEL_DEPLOYMENT.md');
  assert.match(deployment, /schema-v3/i); assert.match(deployment, /Upstash Redis/);
  assert.match(deployment, /ทีมตั้งชื่อเอง/); assert.match(deployment, /บริบทธุรกิจจำลอง/);
  assert.doesNotMatch(deployment, /NovaCart|SiamStay|MetroBank|must not be deployed|Required code migration/i);
});

test('production CSP does not allow inline styles', () => {
  const config = read('vercel.json');
  assert.doesNotMatch(config, /style-src[^;]*unsafe-inline/);
});
