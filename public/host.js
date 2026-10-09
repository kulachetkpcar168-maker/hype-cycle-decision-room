const C = window.GameContent;
const app = document.querySelector('#host-app');
const toast = document.querySelector('#toast');
let state = null;
let hostKey = sessionStorage.getItem('hype-host-key') || '';
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
    headers: { 'content-type': 'application/json', ...(hostKey ? { 'x-host-key': hostKey } : {}), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || 'เกิดข้อผิดพลาด');
    error.status = response.status;
    throw error;
  }
  return body;
}

function brand() {
  return `<header class="host-header"><div class="brand" style="margin:0"><div class="brand-mark">H</div><div><h1>Facilitator Control</h1><p>Hype Cycle Decision Room</p></div></div>${state ? `<span class="pill"><span class="status-dot live"></span>${C.phases[state.phase]}</span>` : ''}</header>`;
}

function renderKeyPrompt() {
  app.innerHTML = `${brand()}<section class="hero"><span class="eyebrow">Host access</span><h2>ใส่ Host Key</h2><p>Key ใช้เฉพาะทีมผู้นำเสนอเพื่อควบคุม Phase และล็อกคำตอบของผู้เล่น</p><form id="key-form"><div class="field"><label for="key">Host Key</label><input id="key" class="input" type="password" required placeholder="HOST_KEY"></div><button class="btn btn-primary">เปิด Control Panel</button></form></section>`;
  document.querySelector('#key-form').addEventListener('submit', (event) => {
    event.preventDefault();
    hostKey = document.querySelector('#key').value;
    sessionStorage.setItem('hype-host-key', hostKey);
    refresh(true);
  });
}

function teamStatus(teamId) {
  const team = state.teams[teamId];
  const meta = C.teams[teamId];
  const current = state.phase === 'round1' || state.phase === 'round1_locked' || state.phase === 'twist' ? team.round1 : team.round2;
  return `<div class="team-status-row"><div><strong style="color:${meta.color}">${meta.label}</strong><div class="muted">${esc(team.displayName || 'ยังไม่เข้าร่วม')}</div><div class="pill" style="margin-top:7px">Code: <strong>${esc(team.accessToken)}</strong></div></div><span class="pill"><span class="status-dot ${team.joined ? 'live' : ''}"></span>${team.joined ? 'Joined' : 'Waiting'}</span><div class="mini-result">${current ? 'ส่งแล้ว' : 'ยังไม่ส่ง'}</div></div>`;
}

function nextPhase() {
  const index = C.phaseOrder.indexOf(state.phase);
  return index < C.phaseOrder.length - 1 ? C.phaseOrder[index + 1] : null;
}

function resultCard(teamId) {
  const team = state.teams[teamId];
  const meta = C.teams[teamId];
  const phaseIndex = C.phaseOrder.indexOf(state.phase);
  const showRound1 = phaseIndex >= C.phaseOrder.indexOf('round1_locked');
  const showRound2 = phaseIndex >= C.phaseOrder.indexOf('round2_locked');
  const summary = (decision, visible) => visible && decision ? `${C.stageShort[decision.stage]} · ${C.actions[decision.action]} · ${decision.confidence}/5` : visible ? '—' : 'ซ่อนจนกว่าจะ Lock';
  const reason = (decision, visible) => visible ? esc(decision?.reason || 'ยังไม่มีคำตอบ') : 'ป้องกันการเห็นคำตอบก่อนจบรอบ';
  return `<article class="card"><span class="eyebrow" style="color:${meta.color}">${meta.label}</span><h3>${esc(team.displayName || meta.title)}</h3><div class="result-row"><div class="result-box"><small class="muted">Round 1</small><h3>${summary(team.round1, showRound1)}</h3><p>${reason(team.round1, showRound1)}</p></div><div class="arrow">→</div><div class="result-box"><small class="muted">Final</small><h3>${summary(team.round2, showRound2)}</h3><p>${reason(team.round2, showRound2)}</p></div></div></article>`;
}

function renderDashboard() {
  const next = nextPhase();
  const joinUrl = `${location.origin}/`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=${encodeURIComponent(joinUrl)}`;
  app.innerHTML = `${brand()}<div class="host-grid"><section class="grid"><div class="card"><div class="section-title"><h3>Team status</h3><span class="muted">Auto refresh</span></div><div class="team-status">${Object.keys(C.teams).map(teamStatus).join('')}</div></div><div class="grid grid-3">${Object.keys(C.teams).map(resultCard).join('')}</div></section><aside class="grid"><section class="card"><span class="eyebrow">Join link</span><h3>เปิดบนมือถือ 3 ทีม</h3><img class="qr" src="${qrUrl}" alt="QR code สำหรับเข้าเกม"><div class="field"><input class="input" readonly value="${esc(joinUrl)}"></div><button id="copy-url" class="btn btn-secondary">คัดลอกลิงก์</button></section><section class="card"><span class="eyebrow">Phase control</span><h3>${C.phases[state.phase]}</h3><div class="phase-control">${next ? `<button id="next-phase" class="btn btn-primary">ไปขั้นต่อไป: ${C.phases[next]}</button>` : '<p class="muted">จบกิจกรรมแล้ว</p>'}${state.phase === 'pitch' ? Object.entries(C.teams).map(([id, team]) => `<button class="btn ${state.activePitchTeam === id ? 'btn-primary' : 'btn-secondary'} pitch-team" data-team="${id}">เปิด Pitch: ${team.label}</button>`).join('') : ''}<button id="reset" class="btn btn-danger">Reset เกม</button><button id="change-key" class="btn btn-secondary">เปลี่ยน Host Key</button></div></section></aside></div>`;
  document.querySelector('#copy-url').addEventListener('click', async () => { await navigator.clipboard.writeText(joinUrl); notify('คัดลอกลิงก์แล้ว'); });
  if (next) document.querySelector('#next-phase').addEventListener('click', () => changePhase(next));
  document.querySelector('#reset').addEventListener('click', resetGame);
  document.querySelector('#change-key').addEventListener('click', () => { sessionStorage.removeItem('hype-host-key'); hostKey = ''; renderKeyPrompt(); });
  document.querySelectorAll('.pitch-team').forEach((button) => button.addEventListener('click', () => selectPitch(button.dataset.team)));
}

async function changePhase(phase) {
  try {
    state = await api('/api/host/phase', { method: 'POST', body: JSON.stringify({ phase }) });
    renderDashboard();
  } catch (error) { notify(error.message); if (error.message.includes('key')) renderKeyPrompt(); }
}

async function selectPitch(teamId) {
  try {
    state = await api('/api/host/pitch-team', { method: 'POST', body: JSON.stringify({ teamId }) });
    renderDashboard();
  } catch (error) { notify(error.message); }
}

async function resetGame() {
  if (!confirm('ล้างคำตอบทุกทีมและกลับไป Lobby?')) return;
  try {
    state = await api('/api/host/reset', { method: 'POST', body: '{}' });
    renderDashboard();
  } catch (error) { notify(error.message); }
}

async function refresh(force = false) {
  if (!hostKey) return renderKeyPrompt();
  try {
    const next = await api('/api/host/state');
    const changed = force || JSON.stringify(next) !== JSON.stringify(state);
    state = next;
    if (changed) renderDashboard();
  } catch (error) {
    notify(error.message);
    if (error.status === 401) {
      sessionStorage.removeItem('hype-host-key');
      hostKey = '';
      state = null;
      renderKeyPrompt();
    }
  }
}

refresh(true);
setInterval(() => refresh(false), 1500);
