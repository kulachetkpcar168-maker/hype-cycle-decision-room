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

test('main team device shows a QR invite for read-only spectators', () => {
  const player = read('public/player.js');
  const html = read('public/index.html');
  assert.match(html, /qr\.js/);
  assert.ok(html.indexOf('/qr.js') < html.indexOf('/player.js'));
  for (const token of ['spectatorToken', 'spectatorInvite', 'สร้าง QR ให้สมาชิกในทีม', 'ดูอย่างเดียว', 'window.BrowserQr.svgDataUrl']) assert.ok(player.includes(token), token);
  assert.match(player, /URLSearchParams/);
  assert.match(player, /x-spectator-token/);
  assert.match(player, /x-spectator-team/);
});

test('player has timer, submitted editing flow, and round two evidence', () => {
  const player = read('public/player.js');
  for (const token of ['roundEndsAt', 'warning', 'ส่งคำตอบแล้ว', 'แก้ไขคำตอบ', 'คำตอบ Round 1 ของทีม', 'ข้อมูลใหม่', 'evidenceCards(C.evidence)']) assert.match(player, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(player, /confidence|changedBy|reason|kpi|type="checkbox"/i);
});

test('player takeaway includes the expanded Hype Cycle lessons', () => {
  const player = read('public/player.js');
  const common = read('public/common.js');
  assert.match(player, /C\.keyTakeaways\.map/);
  for (const text of ['Stage ไม่ใช่คะแนน', 'Evidence ใหม่เปลี่ยนคำตัดสินได้', 'กำหนด use case, Guardrail, KPI และวันทบทวน']) assert.ok(common.includes(text), text);
});

test('player stage choice includes accessible inline Hype Cycle SVG and Thai explanations', () => {
  const player = read('public/player.js');
  assert.match(player, /<svg[^>]+hype-cycle-chart/); assert.match(player, /role="img"/); assert.match(player, /aria-labelledby/);
  assert.match(player, /stage-point/); assert.match(player, /stage-explanation/); assert.match(player, /addEventListener\('change'/);
  assert.match(player, /<fieldset class="field"><legend>Hype Cycle Stage ของ Klarna AI<\/legend>/);
  assert.match(player, /<fieldset class="field"><legend>Action ของบริษัทคุณเกี่ยวกับ AI<\/legend>/);
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

test('player loads the session guard before polling code', () => {
  const html = read('public/index.html');
  assert.match(html, /session-guard\.js/);
  assert.ok(html.indexOf('/session-guard.js') < html.indexOf('/player.js'));
  assert.match(read('public/player.js'), /SessionGuard/);
});

test('host presentation teaches all phases and shows join codes during the lobby', () => {
  const host = read('public/host.js');
  for (const token of ['lobbyPresentation', 'roundOnePresentation', 'roundTwoPresentation', 'revealGrid', 'pitchCard', 'takeawayPresentation', 'teamName', '<details class="code-vault"']) assert.match(host, new RegExp(token));
  assert.ok(host.includes("state.phase==='lobby'?'open':' '"));
  for (const token of ['2.3M', '⅔', '35+', '11→2', '−25%', '700', '$40M', 'สไลด์ก่อนหน้า', 'สไลด์ถัดไป', 'งานที่ AI ทำได้ดี', 'งานที่ยังต้องใช้คน', 'hybrid-escalation']) assert.ok(host.includes(token), token);
  assert.match(host, /เปลี่ยน Phase แล้ว/); assert.match(host, /activePitchTeam/); assert.doesNotMatch(host, /winner|leaderboard|score|ranking|vote/i);
  assert.match(host, /\/join-qr\.svg/); assert.doesNotMatch(host, /api\.qrserver\.com/);
  for (const token of ['hostHypeGraph', 'host-hype-map', 'Innovation Trigger', 'Peak', 'Trough', 'Slope', 'Plateau', 'Evidence → Stage → Action']) assert.ok(host.includes(token), token);
});

test('selected-team pitch shows both rounds with each round evidence and risk', () => {
  const host = read('public/host.js');
  for (const token of ['pitchDecisionCard', "pitchDecisionCard(t.round1,'Before')", "pitchDecisionCard(t.round2,'After')", 'Evidence ที่มีอิทธิพลที่สุด', 'ความเสี่ยงหลัก']) assert.ok(host.includes(token), token);
  assert.doesNotMatch(host, /Evidence ที่เปลี่ยนคำตัดสิน/);
  assert.doesNotMatch(host, /latest=t\.round2\|\|t\.round1/);
  assert.match(host, /pitchStageGraph/);
  assert.match(host, /stage-point/);
});

test('decision dropdown labels use clear Thai business language', () => {
  const common = read('public/common.js');
  for (const text of ['AI รับผิดชอบแชตประมาณ 2 ใน 3', 'เวลาแก้ปัญหาลดจาก 11 เหลือไม่ถึง 2 นาที', 'Klarna คาดว่ากำไรดีขึ้น $40M ในปี 2024', 'เคสซับซ้อนต้องส่งต่อให้คน', 'ความยากในการเชื่อมระบบ ข้อมูล และ Workflow', 'ความเสียหายจากคำตอบหรือการตัดสินใจผิด']) assert.ok(common.includes(text), text);
  assert.doesNotMatch(common, /ข้อควรระวัง:\s*ตัวเลขมาจากบริษัท/);
  assert.doesNotMatch(common, /id:'company_reported'/);
  assert.doesNotMatch(common, /กำไรเพิ่ม \$40M ต่อปี/);
});

test('takeaway phase gives one human one-page Klarna answer and five Hype Cycle lessons', () => {
  const host = read('public/host.js');
  const common = read('public/common.js');
  for (const token of ['Klarna ทำอะไร', 'Klarna ควรทำอะไรต่อ', 'Hybrid service', 'AI รับงานมาตรฐาน', 'คนรับช่วงเคสซับซ้อน', 'คำตอบแนะนำ']) assert.ok(host.includes(token) || common.includes(token), token);
  for (const token of ['Hype มาก่อน Value', 'Trough คือช่วงคัดกรอง', 'คนละ Stage คนละ Strategy', 'Timing สำคัญ', 'ตัดสินใจจาก Data ไม่ใช่ Noise']) assert.ok(common.includes(token), token);
  assert.doesNotMatch(host, /takeawaySlides|สไลด์ 1\/4|สไลด์ 4\/4/);
});

test('host loads the key-form polling gate before dashboard code', () => {
  const html = read('public/host.html');
  assert.match(html, /host-key-gate\.js/);
  assert.ok(html.indexOf('/host-key-gate.js') < html.indexOf('/host.js'));
  assert.match(read('public/host.js'), /HostKeyGate/);
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
  for (const token of ['.phase-hero', '.timer.warning', '.access-code', '.hype-cycle-chart', '.stage-point', '.host-hype-map', '.presentation-slide', '.hybrid-escalation', '@media(max-width:760px)', '.decision-flow{grid-template-columns:1fr}', '.graph-evidence-note{flex-direction:column']) assert.ok(css.includes(token), token);
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
