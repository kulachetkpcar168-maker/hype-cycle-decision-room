const C = window.GameContent;
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let serverState = null;
let selectedTeam = localStorage.getItem('hype-team') || '';
let teamToken = sessionStorage.getItem('hype-team-token') || '';
let timer = null;

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(selectedTeam && teamToken ? { 'x-team-id': selectedTeam, 'x-team-token': teamToken } : {}),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'เกิดข้อผิดพลาด');
  return body;
}

function brand() {
  return `<header class="brand"><div class="brand-mark">H</div><div><h1>Hype Cycle Decision Room</h1><p>Agentic AI × Strategic Decision</p></div></header>`;
}

function phaseBar() {
  const index = Math.max(0, C.phaseOrder.indexOf(serverState.phase));
  const progress = (index / (C.phaseOrder.length - 1)) * 100;
  return `<div class="section-title"><span class="pill"><span class="status-dot live"></span>${C.phases[serverState.phase]}</span><span class="muted">Phase ${index + 1}/${C.phaseOrder.length}</span></div><div class="progress"><span style="width:${progress}%"></span></div>`;
}

function renderTeamChoice() {
  app.innerHTML = `${brand()}<section class="hero"><span class="eyebrow">Join the room</span><h2>เลือกบทบาทของทีม</h2><p>หนึ่งอุปกรณ์ต่อหนึ่งทีม เลือกบริบทที่อาจารย์หรือ Facilitator กำหนด แล้วตั้งชื่อทีมเพื่อเริ่มกิจกรรม</p></section><section class="grid grid-3">${Object.entries(C.teams).map(([id, team]) => `<button class="card team-card" data-team="${id}" style="--team:${team.color}"><span class="team-icon" style="color:${team.color}">${team.icon}</span><h3>${team.label}</h3><p>${team.brief}</p></button>`).join('')}</section><p class="footer-note">ไม่มีคะแนน ไม่มีผู้ชนะ — เป้าหมายคือใช้ Evidence ตัดสินใจให้เหมาะกับบริบท</p>`;
  document.querySelectorAll('[data-team]').forEach((button) => button.addEventListener('click', () => renderJoinForm(button.dataset.team)));
}

function renderJoinForm(teamId) {
  const team = C.teams[teamId];
  app.innerHTML = `${brand()}<section class="hero"><span class="eyebrow">${team.label}</span><h2>${team.title}</h2><p>${team.brief}</p><div class="callout">โจทย์ของคุณ: ${team.question}</div><form id="join-form"><div class="field"><label for="team-code">Team Access Code</label><input id="team-code" class="input" maxlength="8" required autocomplete="off" placeholder="รับ Code จาก Facilitator"></div><div class="field"><label for="team-name">ชื่อทีม</label><input id="team-name" class="input" maxlength="40" required placeholder="เช่น Team Insight"></div><div class="actions"><button type="button" class="btn btn-secondary" id="back">ย้อนกลับ</button><button class="btn btn-primary">เข้าร่วมเกม</button></div></form></section>`;
  document.querySelector('#back').addEventListener('click', renderTeamChoice);
  document.querySelector('#join-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      selectedTeam = teamId;
      teamToken = document.querySelector('#team-code').value.trim();
      serverState = await api(`/api/teams/${teamId}/join`, { method: 'POST', body: JSON.stringify({ displayName: document.querySelector('#team-name').value }) });
      localStorage.setItem('hype-team', teamId);
      sessionStorage.setItem('hype-team-token', teamToken);
      render();
    } catch (error) {
      selectedTeam = '';
      teamToken = '';
      notify(error.message);
    }
  });
}

function contextCard(teamId) {
  const team = C.teams[teamId];
  return `<section class="card"><span class="eyebrow">Your context</span><h3 style="color:${team.color}">${team.title}</h3><p>${team.brief}</p><div class="callout">${team.question}</div><div class="section-title"><h3>สิ่งที่องค์กรให้ความสำคัญ</h3></div><div class="actions">${team.priorities.map((item) => `<span class="pill">${item}</span>`).join('')}</div></section>`;
}

function evidenceCards(selectable = false, selected = []) {
  return `<div class="evidence">${C.evidence.map((item) => selectable ? `<label class="evidence-pick"><input type="checkbox" name="evidence" value="${item.id}" ${selected.includes(item.id) ? 'checked' : ''}><article class="evidence-card"><div class="evidence-stat">${item.stat}</div><div><h4>${item.title}</h4><p>${item.text}</p></div></article></label>` : `<article class="evidence-card"><div class="evidence-stat">${item.stat}</div><div><h4>${item.title}</h4><p>${item.text}</p></div></article>`).join('')}</div>`;
}

function caseIntro() {
  return `<section class="hero"><span class="eyebrow">Company case × Technology</span><h2>Klarna × Agentic AI</h2><p>Klarna นำ AI Assistant มาใช้ตอบคำถาม ช่วยจัดการเรื่องการชำระเงิน คืนเงิน และปัญหาลูกค้าหลายภาษา วิเคราะห์ <strong>Agentic AI for Customer Service</strong> — ไม่ใช่จัดบริษัท Klarna ทั้งบริษัทลงบนกราฟ</p><div class="callout">ข้อมูลในรอบแรกเป็นผลลัพธ์ที่บริษัทประกาศเอง จงพิจารณาทั้งตัวเลขและคุณภาพของแหล่งข้อมูล</div></section>`;
}

function choice(name, value, label, help, checked) {
  return `<label class="choice"><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''} required><span><strong>${label}</strong>${help ? `<small>${help}</small>` : ''}</span></label>`;
}

function renderRoundForm(round) {
  const teamState = serverState.teams[selectedTeam];
  const previous = teamState[`round${round}`] || (round === 2 ? teamState.round1 : null) || {};
  const evidence = previous.evidence || [];
  app.innerHTML = `${brand()}${phaseBar()}${contextCard(selectedTeam)}${caseIntro()}<div class="section-title"><h3>Evidence Card</h3><span id="evidence-count" class="counter">${evidence.length}/3</span></div>${evidenceCards(true, evidence)}${round === 2 ? twistSection() : ''}<form id="decision-form" class="card" style="margin-top:18px"><span class="eyebrow">Round ${round} decision</span><div class="field"><span class="label">1. Technology อยู่ Stage ไหน?</span><div class="choice-grid">${Object.entries(C.stages).map(([id, label]) => choice('stage', id, label, '', previous.stage === id)).join('')}</div></div><div class="field"><span class="label">2. องค์กรควรทำอะไร?</span><div class="choice-grid">${Object.entries(C.actions).map(([id, label]) => choice('action', id, label, C.actionHelp[id], previous.action === id)).join('')}</div></div><div class="field"><label for="reason">3. เหตุผลสั้น ๆ <span class="muted">(ไม่เกิน 200 ตัวอักษร)</span></label><textarea id="reason" maxlength="200" required>${esc(previous.reason || '')}</textarea></div><div class="field"><label for="kpi">4. KPI ที่ต้องติดตาม</label><select id="kpi" required><option value="">เลือก KPI</option>${Object.entries(C.kpis).map(([id, label]) => `<option value="${id}" ${previous.kpi === id ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label for="confidence">5. Confidence: <span id="confidence-label" class="counter">${previous.confidence || 3}/5</span></label><input id="confidence" type="range" min="1" max="5" step="1" value="${previous.confidence || 3}"></div>${round === 2 ? `<div class="field"><label for="changed-by">6. Evidence ใหม่ข้อใดทำให้เปลี่ยนหรือไม่เปลี่ยนความคิด?</label><textarea id="changed-by" maxlength="200" required>${esc(previous.changedBy || '')}</textarea></div>` : ''}<div class="actions"><button class="btn btn-primary">ส่งคำตอบ Round ${round}</button></div></form>`;
  document.querySelectorAll('input[name="evidence"]').forEach((box) => box.addEventListener('change', updateEvidenceLimit));
  document.querySelector('#confidence').addEventListener('input', (event) => { document.querySelector('#confidence-label').textContent = `${event.target.value}/5`; });
  document.querySelector('#decision-form').addEventListener('submit', (event) => submitDecision(event, round));
  updateEvidenceLimit();
}

function updateEvidenceLimit() {
  const boxes = [...document.querySelectorAll('input[name="evidence"]')];
  const checked = boxes.filter((box) => box.checked);
  boxes.forEach((box) => { box.disabled = !box.checked && checked.length >= 3; });
  const counter = document.querySelector('#evidence-count');
  if (counter) counter.textContent = `${checked.length}/3`;
}

async function submitDecision(event, round) {
  event.preventDefault();
  const evidence = [...document.querySelectorAll('input[name="evidence"]:checked')].map((box) => box.value);
  if (evidence.length !== 3) return notify('เลือก Evidence ให้ครบ 3 ข้อ');
  const form = new FormData(event.target);
  const payload = {
    stage: form.get('stage'), action: form.get('action'), evidence,
    reason: document.querySelector('#reason').value,
    kpi: document.querySelector('#kpi').value,
    confidence: Number(document.querySelector('#confidence').value),
  };
  if (round === 2) payload.changedBy = document.querySelector('#changed-by').value;
  try {
    serverState = await api(`/api/teams/${selectedTeam}/submissions/${round}`, { method: 'POST', body: JSON.stringify(payload) });
    notify('บันทึกคำตอบแล้ว');
    render();
  } catch (error) { notify(error.message); }
}

function twistSection() {
  return `<section class="hero twist"><span class="eyebrow">New evidence unlocked</span><h2>Human Reality Check</h2><p>หลังองค์กรเริ่มใช้ AI Customer Service มากขึ้น พบว่าความเร็วและต้นทุนไม่ใช่คำตอบทั้งหมด</p><div class="grid grid-2">${C.twist.map((item) => `<article class="card"><h3>${item.title}</h3><p>${item.text}</p></article>`).join('')}</div></section>`;
}

function decisionSummary(decision, title) {
  if (!decision) return `<div class="result-box"><span class="muted">${title}</span><h3>ยังไม่มีคำตอบ</h3></div>`;
  return `<div class="result-box"><span class="muted">${title}</span><h3>${C.stages[decision.stage]}</h3><span class="pill">${C.actions[decision.action]}</span><p>${esc(decision.reason)}</p><small class="muted">KPI: ${C.kpis[decision.kpi]} · Confidence ${decision.confidence}/5</small></div>`;
}

function resultSection(teamState) {
  return `<section class="card"><span class="eyebrow">Before → After</span><div class="result-row">${decisionSummary(teamState.round1, 'Round 1')}<div class="arrow">→</div>${decisionSummary(teamState.round2, 'Final decision')}</div>${teamState.round2?.changedBy ? `<div class="callout" style="margin-top:14px"><strong>Evidence ที่เปลี่ยนความคิด:</strong> ${esc(teamState.round2.changedBy)}</div>` : ''}</section>`;
}

function renderWaiting(message, includeTwist = false) {
  const teamState = serverState.teams[selectedTeam];
  app.innerHTML = `${brand()}${phaseBar()}${includeTwist ? twistSection() : ''}<section class="hero big-state"><div><div class="symbol">⏳</div><span class="eyebrow">Answer saved</span><h2>${message}</h2><p>Facilitator จะเปิดขั้นต่อไปพร้อมกันทั้งห้อง</p>${resultSection(teamState)}</div></section>`;
}

function renderPitch() {
  const teamState = serverState.teams[selectedTeam];
  const active = serverState.activePitchTeam === selectedTeam;
  app.innerHTML = `${brand()}${phaseBar()}${resultSection(teamState)}<section class="hero ${active ? '' : 'big-state'}"><span class="eyebrow">1-minute pitch</span><h2>${active ? 'ถึงเวลานำเสนอของทีมคุณ' : 'รอทีมที่กำลังนำเสนอ'}</h2><div class="card" style="text-align:left"><p>“องค์กรของเราคือ <strong>${C.teams[selectedTeam].title}</strong>”</p><p>“รอบแรกเราเลือก <strong>${teamState.round1 ? `${C.stageShort[teamState.round1.stage]} / ${C.actions[teamState.round1.action]}` : '—'}</strong>”</p><p>“หลังได้ข้อมูลใหม่ เราเลือก <strong>${teamState.round2 ? `${C.stageShort[teamState.round2.stage]} / ${C.actions[teamState.round2.action]}` : '—'}</strong> เพราะ…”</p><p>“KPI ที่ต้องติดตามคือ <strong>${teamState.round2 ? C.kpis[teamState.round2.kpi] : '—'}</strong>”</p></div></section>`;
}

function render() {
  if (!serverState) return;
  if (!selectedTeam || !serverState.teams[selectedTeam]) return renderTeamChoice();
  const teamState = serverState.teams[selectedTeam];
  if (!teamState.joined || !teamToken) {
    selectedTeam = '';
    teamToken = '';
    localStorage.removeItem('hype-team');
    sessionStorage.removeItem('hype-team-token');
    return renderTeamChoice();
  }
  const phase = serverState.phase;
  if (phase === 'lobby') {
    app.innerHTML = `${brand()}${phaseBar()}${contextCard(selectedTeam)}<section class="hero big-state"><div><div class="symbol">✓</div><span class="eyebrow">Team joined</span><h2>รอ Facilitator เปิด Round 1</h2><p>เตรียมคนอ่าน Evidence คนโต้แย้ง คนกรอกคำตอบ และผู้นำเสนอ</p></div></section>`;
  } else if (phase === 'round1') renderRoundForm(1);
  else if (phase === 'round1_locked') renderWaiting('Round 1 ถูกล็อกแล้ว');
  else if (phase === 'twist') renderWaiting('อ่าน New Evidence แล้วรอเปิด Round 2', true);
  else if (phase === 'round2') renderRoundForm(2);
  else if (phase === 'round2_locked') renderWaiting('บันทึกคำตอบสุดท้ายแล้ว', true);
  else if (phase === 'pitch') renderPitch();
  else if (phase === 'debrief') app.innerHTML = `${brand()}${phaseBar()}${resultSection(teamState)}<section class="hero"><span class="eyebrow">Key takeaway</span><h2>Stage informs the decision. Context determines the action.</h2><p>เทคโนโลยีเดียวกันอาจอยู่ Stage เดียวกัน แต่ Startup, SME และ Corporate ไม่จำเป็นต้องเลือก Action เหมือนกัน</p></section>`;
}

async function refresh() {
  try {
    const next = await api('/api/state');
    const changed = JSON.stringify(next) !== JSON.stringify(serverState);
    serverState = next;
    if (changed) render();
  } catch (error) { notify('เชื่อมต่อ Server ไม่ได้'); }
}

refresh();
setInterval(refresh, 1500);
