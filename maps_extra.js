// 포트리스2 맵을 참고한 새 맵들 (혼자 하기와 온라인 엔진이 똑같은 코드를 씀)
// 재료: 1 흙, 2 돌, 3 나무 발판. col(x,y0,y1,m) 세로줄 채우기, rect, ellipse, plank, rand(a,b), R()
function paintExtraMap(kind, WW, WH, nTanks, rand, R, col, rect, ellipse, plank, valleys) {
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  if (kind === 'sphinx') {
    // 스핑크스 계단: 양쪽 끝이 계단처럼 높이 솟고 가운데는 넓게 파인 이집트풍 맵 (끝의 높은 곳이 유리)
    const steps = 4 + Math.floor(R() * 2), sw = WW * rand(0.055, 0.07), top = WH * rand(0.26, 0.34), pit = WH * rand(0.78, 0.84), dh = (pit - top) / steps;
    for (let x = 0; x < WW; x++) {
      const e = Math.min(x, WW - 1 - x); const k = Math.floor(e / sw); let y = k >= steps ? pit : top + dh * k;
      y += Math.sin(x / 41) * 4; col(x, y, WH - 1, 1); col(x, y, y + 12, 2);   // 계단 윗면은 돌
    }
    // 가운데 작은 피라미드
    const px = WW / 2 + rand(-WW * 0.06, WW * 0.06), pw = rand(170, 260), ph = rand(110, 170);
    for (let x = Math.ceil(px - pw); x <= px + pw; x++) col(x, pit - ph * (1 - Math.abs(x - px) / pw), pit, 2);
  } else if (kind === 'logbridge') {
    // 외나무다리: 양쪽 끝 두꺼운 절벽 사이를 얇은 외나무다리 하나가 잇는 맵 (떨어지면 끝)
    const cw = WW * rand(0.12, 0.15), cy = WH * rand(0.46, 0.54);
    for (let x = 0; x < WW; x++) { const e = Math.min(x, WW - 1 - x); if (e < cw) col(x, cy - 30 + Math.sin(x / 70) * 10 - (cw - e) * 0.25, WH - 1, 1); }
    const ph = rand(0, 6);
    for (let x = Math.floor(cw - 30); x < WW - cw + 30; x++) { const y = cy + Math.sin(x / 260 + ph) * 26; col(x, y, y + 15, 3); }
    // 다리 아래 작은 섬 두어 개 (떨어지다 걸릴 수 있음)
    const k = 1 + Math.floor(R() * 2); for (let i = 0; i < k; i++) ellipse(cw + (WW - 2 * cw) * rand(0.2, 0.8), WH * rand(0.74, 0.84), rand(70, 120), rand(16, 26), 1);
  } else if (kind === 'island') {
    // 구름 섬: 가운데 큰 섬과 초가집, 양옆은 몽실몽실 구름 발판
    const ix = WW / 2, iw = WW * rand(0.16, 0.2), itop = WH * rand(0.48, 0.55);
    for (let x = Math.ceil(ix - iw); x <= ix + iw; x++) { const t = (x - ix) / iw; const y = itop + 40 * t * t + Math.sin(x / 33) * 5; col(x, y, itop + 140 + 230 * (1 - t * t), 1); }
    // 초가집 (나무 벽 + 흙 지붕)
    const hx = ix + rand(-iw * 0.3, iw * 0.3), hy = itop + 40 * Math.pow((hx - ix) / iw, 2);
    rect(hx - 50, hy - 70, 100, 70, 3); for (let x = Math.ceil(hx - 70); x <= hx + 70; x++) col(x, hy - 70 - 45 * (1 - Math.abs(x - hx) / 70), hy - 64, 1);
    // 구름: 양쪽에 층층이
    const side = (x0, x1) => { const rows = [0.3, 0.46, 0.62, 0.76]; for (const r of rows) { let x = x0 + rand(0, 120); while (x < x1 - 100) { const w = rand(150, 260), y = WH * r + rand(-30, 30); for (let j = 0; j < 4; j++) ellipse(x + w * (j + 0.5) / 4, y + rand(-6, 6), w / 4 + rand(10, 24), rand(16, 26), 1); x += w + rand(110, 200); } } };
    side(40, ix - iw - 80); side(ix + iw + 80, WW - 40);
  } else if (kind === 'grave') {
    // 비석 언덕: 얇은 땅 위에 비석이 서 있고, 가장자리로 갈수록 땅이 두꺼워짐. 가운데 아래에 얇은 층이 하나 더
    const base = WH * rand(0.5, 0.58), ph = rand(0, 6);
    const surf = x => base + Math.sin(x / 210 + ph) * 45 + Math.sin(x / 63) * 10;
    for (let x = 0; x < WW; x++) { const e = Math.min(x, WW - 1 - x) / (WW / 2); const th = 24 + Math.pow(1 - e, 3) * 420; col(x, surf(x), surf(x) + th, 1); }
    const lw = WW * rand(0.18, 0.24), ly = WH * rand(0.78, 0.84);
    for (let x = Math.floor(WW / 2 - lw); x < WW / 2 + lw; x++) { const y = ly + Math.sin(x / 90) * 12; col(x, y, y + 18, 1); }
    const k = Math.round(WW / 260);
    for (let i = 0; i < k; i++) { const x = (i + 0.5) / k * WW + rand(-60, 60), y = surf(x), w = rand(22, 30), h = rand(40, 62);
      for (let xx = Math.ceil(x - w / 2); xx <= x + w / 2; xx++) { const d = Math.abs(xx - x) / (w / 2); col(xx, y - h - Math.sqrt(Math.max(0, 1 - d * d)) * w * 0.45, y + 4, 2); } }
  } else if (kind === 'wisland') {
    // 웜즈 섬: 바다 위에 울퉁불퉁한 큰 섬 2~3개, 섬 속에 동굴 구멍이 숭숭, 떠 있는 바위 조각
    const n = 2 + Math.floor(R() * 2), gap = rand(140, 220), w = (WW - gap * (n + 1)) / n;
    const ph = [rand(0, 6), rand(0, 6), rand(0, 6), rand(0, 6)];
    const noise = (x, k) => Math.sin(x / 97 + ph[k]) * 40 + Math.sin(x / 41 + ph[k + 1]) * 16 + Math.sin(x / 17 + ph[k]) * 5;
    for (let i = 0; i < n; i++) { const x0 = gap + i * (w + gap), x1 = x0 + w, top = WH * rand(0.36, 0.5), bot = WH * rand(0.8, 0.9);
      for (let x = Math.floor(x0 - 40); x < x1 + 40; x++) { const t = (x - x0) / w; const edge = Math.min(1, Math.min(t, 1 - t) * 6 + 0.15); if (edge <= 0.05) continue;
        const y0 = top + noise(x, 0) + (1 - edge) * 260, y1 = bot + noise(x, 2) * 0.6 - (1 - edge) * 120; if (y1 > y0) col(x, y0, y1, 1); }
      // 동굴 구멍
      const holes = 3 + Math.floor(R() * 4); for (let h = 0; h < holes; h++) ellipse(rand(x0 + 60, x1 - 60), rand(top + 110, bot - 70), rand(40, 90), rand(28, 55), 0);
    }
    // 떠 있는 바위
    const k = Math.round(WW / 700); for (let i = 0; i < k; i++) ellipse(rand(80, WW - 80), WH * rand(0.14, 0.32), rand(50, 110), rand(14, 26), 1);
  } else if (kind === 'wcave') {
    // 웜즈 동굴: 위에도 천장이 막힌 큰 동굴. 종유석·석순 기둥, 가운데 떠 있는 바위 (높이 쏘면 천장에 맞음)
    const ph = [rand(0, 6), rand(0, 6), rand(0, 6)];
    const ceil = x => WH * 0.13 + Math.sin(x / 120 + ph[0]) * 40 + Math.sin(x / 37 + ph[1]) * 12;
    const floor = x => WH * 0.8 + Math.sin(x / 140 + ph[2]) * 50 + Math.sin(x / 29 + ph[0]) * 10;
    for (let x = 0; x < WW; x++) { col(x, 0, ceil(x), 2); col(x, ceil(x) - 30, ceil(x), 1); col(x, floor(x), WH - 1, 1); }
    // 종유석(위에서 아래로)과 석순(아래에서 위로)
    const k = Math.round(WW / 260);
    for (let i = 0; i < k; i++) { const x = rand(60, WW - 60), w = rand(26, 60), up = R() < 0.5, len = rand(90, 260);
      for (let xx = Math.ceil(x - w); xx <= x + w; xx++) { const d = 1 - Math.abs(xx - x) / w; if (up) col(xx, floor(xx) - len * d, floor(xx), 1); else col(xx, ceil(xx), ceil(xx) + len * d, 1); } }
    // 천장과 바닥을 잇는 큰 기둥 몇 개
    const pc = 1 + Math.floor(WW / 1600); for (let i = 0; i < pc; i++) { const x = (i + 0.5) / pc * WW + rand(-120, 120), w = rand(40, 70); for (let xx = Math.ceil(x - w); xx <= x + w; xx++) col(xx, ceil(xx), floor(xx), 1); ellipse(x, (ceil(x) + floor(x)) / 2, w * 0.7, rand(50, 90), 0); }
    const fk = Math.round(WW / 600); for (let i = 0; i < fk; i++) ellipse(rand(100, WW - 100), WH * rand(0.4, 0.58), rand(60, 130), rand(16, 28), 1);
    // 시작 자리: 바닥 위 (천장 위가 아니라 동굴 안)
    for (let i = 0; i < 24; i++) { const x = Math.round((i + 0.5) / 24 * WW); valleys.push({ x, y: -1 }); }
  } else if (kind === 'cheese') {
    // 치즈 섬: 구멍 숭숭 뚫린 커다란 치즈 덩어리들, 아래는 물
    const blocks = 2 + Math.floor(WW / 1500);
    for (let b = 0; b < blocks; b++) { const w = WW / blocks * rand(0.62, 0.8), x0 = (b + 0.5) * WW / blocks - w / 2, top = WH * rand(0.34, 0.52), bot = WH * rand(0.78, 0.88), slope = rand(-0.12, 0.12);
      for (let x = Math.floor(x0); x < x0 + w; x++) { const y0 = top + (x - x0) * slope; col(x, y0, bot, 1); }
      const holes = Math.round(w * (bot - top) / 9000); for (let h = 0; h < holes; h++) { const r = rand(16, 54); ellipse(rand(x0 + r, x0 + w - r), rand(top + r + 10, bot - r), r, r, 0); } }
  }
  void cl; void valleys;
}
// ---- 환경 요소: 회오리 (포트리스2 참고) ----
// 일반 회오리: 포탄을 휘감아 하늘로 올렸다가 근처로 떨어뜨림
// 불꽃 회오리: 포탄을 휘감아 올렸다가 아무 방향으로나 세게 던짐 + 그 포탄의 피해 2배
function twisterNew(WW, surf, rand, id) {
  const fire = rand(0, 1) < 0.35, x = rand(WW * 0.12, WW * 0.88);
  return { id, x, base: surf(x), h: rand(430, 650), w: fire ? 54 : 46, fire, life: 3 + Math.floor(rand(0, 4)), vx: rand(-80, 80) };
}
function twisterTurn(list, WW, surf, wind, rand, nextId) {
  for (const t of list) { t.life--; t.x = Math.max(60, Math.min(WW - 60, t.x + t.vx + wind * 2)); t.base = surf(t.x); }
  for (let i = list.length - 1; i >= 0; i--) if (list[i].life <= 0) list.splice(i, 1);
  if (list.length < 2 && rand(0, 1) < 0.22) list.push(twisterNew(WW, surf, rand, nextId()));
  return list;
}
function twisterStep(p, h, list, rand, onEvt, wind) {
  if (!list || !list.length) return false;
  if (p.tw) {
    const t = list.find(o => o.id === p.tw.id); if (!t) { p.tw = null; return false; }
    p.tw.a += 11 * h; p.y -= 430 * h; const r = 8 + Math.max(0, (t.base - p.y) / t.h) * t.w; p.x = t.x + Math.sin(p.tw.a) * r;
    if (p.y <= t.base - t.h) {
      const tw0 = p.tw; p.tw = null; (p.twUsed || (p.twUsed = {}))[t.id] = 1;
      // 꼭대기에서 아무 방향으로 튕겨 나감: 내가 쏜 힘(세기)과 바람·회오리 움직임을 합침 (꼭대기에서 힘을 잃고 그 자리로 떨어지지 않게)
      const vx0 = tw0.vx0 || 0, vy0 = tw0.vy0 || 0, s0 = Math.hypot(vx0, vy0), w = (wind || 0) * 1.6, drift = (t.vx || 0) * 2;
      if (t.fire) { // 불꽃 회오리: 원래 힘보다 세게, 방향은 예측 불가
        const sp = Math.max(420, s0) * (0.9 + rand(0, 0.5)), ang = rand(-Math.PI * 0.92, -Math.PI * 0.08);
        p.vx = Math.cos(ang) * sp + vx0 * 0.35 + w + drift; p.vy = Math.sin(ang) * sp * 0.8; p.dmgX = 2; if (onEvt) onEvt('fire_out', p); }
      else { // 일반 회오리: 불꽃 회오리처럼 앞뒤 상관없이 아무 방향으로 날아감 (힘은 조금 약하게, 피해는 그대로)
        const sp = Math.max(360, s0) * (0.7 + rand(0, 0.5)), ang = rand(-Math.PI * 0.92, -Math.PI * 0.08);
        p.vx = Math.cos(ang) * sp + w + drift; p.vy = Math.sin(ang) * sp * 0.8; if (onEvt) onEvt('wind_out', p); }
    }
    return true;
  }
  for (const t of list) {
    if (p.twUsed && p.twUsed[t.id]) continue;
    const k = (t.base - p.y) / t.h;
    if (k > 0 && k < 1 && Math.abs(p.x - t.x) < t.w * (0.35 + 0.65 * k)) { p.tw = { id: t.id, a: 0, vx0: p.vx, vy0: p.vy }; if (onEvt) onEvt(t.fire ? 'fire_in' : 'wind_in', p); return true; }
  }
  return false;
}

/* ===== 환경 요소 12종 (회오리 말고) — 혼자 하기·서버가 함께 씀 =====
   C = {WW, WH, kind, R, wind, isSolid(x,y), spawn({x,y,vx,vy,w}), text(x,y,s,c,z), fill(x1,y1,x2,y2), clear(x1,y1,x2,y2)} */
const ENV_INFO = { cloud: '⚡ 번개 구름', meteor: '☄️ 운석 경보', bridge: '🌈 무지개 다리', hole: '🌀 블랙홀', gust: '💨 돌풍 띠', crystal: '🪞 반사 수정',
  tide: '🌊 밀물', volcano: '🌋 화산', ice: '🧊 빙판', balloon: '🎁 황금 풍선', qbox: '❓ 퀴즈 상자', boss: '👑 보스 비행선' };
const ENV_ONE = ['tide', 'volcano', 'ice', 'boss'];   // 한 번에 하나만
const ENV_PRIZES = ['air', 'triple', 'napalm', 'death', 'leap', 'nuke'];
function envNew() { return { list: [], seq: 1, water: null }; }
function envPool(kind) {
  if (kind === 'wcave') return [['hole', 3], ['crystal', 3], ['gust', 2], ['qbox', 3], ['balloon', 2], ['tide', 2], ['bridge', 2]];
  const p = [['cloud', 3], ['meteor', 2], ['bridge', 2], ['hole', 2], ['gust', 2], ['crystal', 2], ['balloon', 3], ['qbox', 3], ['boss', 1]];
  if (!['hills', 'scorched', 'sphinx'].includes(kind)) p.push(['tide', 2]);
  if (['hills', 'scorched', 'sphinx', 'canyon', 'grave', 'towers', 'sky'].includes(kind)) p.push(['volcano', 2], ['ice', 2]);
  return p;
}
function envClamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function envSurf(C, x) { x = Math.round(x); for (let y = 0; y < C.WH; y++) if (C.isSolid(x, y)) return y; return C.WH; }
// 하늘의 빈 자리 찾기 (주변 반지름 rr 안에 땅이 없는 곳)
function envAir(C, rr, x0, x1, y0, y1) {
  const R = C.R;
  for (let k = 0; k < 40; k++) {
    const x = Math.round(x0 + R() * (x1 - x0)), y = Math.round(y0 + R() * (y1 - y0)); let ok = true;
    for (let a = 0; a < 12 && ok; a++) { const an = a / 12 * Math.PI * 2; if (C.isSolid(x + Math.cos(an) * rr, y + Math.sin(an) * rr) || C.isSolid(x + Math.cos(an) * rr * 0.5, y + Math.sin(an) * rr * 0.5)) ok = false; }
    if (ok && !C.isSolid(x, y)) { let g = y; while (g < C.WH && !C.isSolid(x, g)) g++; if (g - y > 110 || C.kind === 'wcave') return { x, y }; }
  }
  return null;
}
function envMake(k, st, C) {
  const R = C.R, rand = (a, b) => a + R() * (b - a), WW = C.WW, WH = C.WH, id = st.seq++;
  switch (k) {
    case 'cloud': return { t: k, id, x: Math.round(rand(200, WW - 200)), y: 70, vx: rand(-25, 25), cd: 3, life: 7 };
    case 'meteor': return { t: k, id, x: Math.round(rand(300, WW - 300)), dir: R() < 0.5 ? -1 : 1, life: 2 };
    case 'bridge': {
      for (let tr = 0; tr < 40; tr++) {
        const len = rand(320, 520), x1 = Math.round(rand(80, WW - 80 - len)), x2 = Math.round(x1 + len), y = Math.round(rand(WH * 0.18, WH * 0.75)); let ok = true;
        for (let x = x1; x <= x2 && ok; x += 10) if (C.isSolid(x, y - 40) || C.isSolid(x, y) || C.isSolid(x, y + 14)) ok = false;
        if (!ok) continue; let g = y; const mx = (x1 + x2) >> 1; while (g < WH && !C.isSolid(mx, g)) g++; if (g - y < 120 && C.kind !== 'wcave') continue;
        return { t: k, id, x1, x2, y, th: 12, life: 2 };
      }
      return null;
    }
    case 'hole': {
      const a = envAir(C, 40, WW * 0.08, WW * 0.45, 140, WH * 0.7), b = envAir(C, 40, WW * 0.55, WW * 0.92, 140, WH * 0.7);
      if (!a || !b) return null; if (R() < 0.5) return { t: k, id, ax: a.x, ay: a.y, bx: b.x, by: b.y, life: 4 }; return { t: k, id, ax: b.x, ay: b.y, bx: a.x, by: a.y, life: 4 };
    }
    case 'gust': return { t: k, id, y: Math.round(rand(WH * 0.15, WH * 0.5)), hh: 45, dir: R() < 0.5 ? -1 : 1, pow: 750, life: 3 };
    case 'crystal': { const a = envAir(C, 44, WW * 0.15, WW * 0.85, 140, WH * 0.7); return a ? { t: k, id, x: a.x, y: a.y, r: 30, hp: 3, life: 6 } : null; }
    case 'tide': return { t: k, id, step: 34, life: 4, first: 1 };
    case 'volcano': {
      let bx = -1, by = WH; for (let x = 160; x < WW - 160; x += 16) { const y = envSurf(C, x); if (y < by) { by = y; bx = x; } }
      if (bx < 0 || by > WH - 80) return null; return { t: k, id, x: bx, y: by, cd: 2, life: 6 };
    }
    case 'ice': { const len = rand(420, 720), x1 = Math.round(rand(60, WW - 60 - len)); return { t: k, id, x1, x2: Math.round(x1 + len), life: 6 }; }
    case 'balloon': { const a = envAir(C, 36, 150, WW - 150, 130, WH * 0.55); return a ? { t: k, id, x: a.x, y: a.y, vx: rand(-20, 20), life: 5, prize: R() < 0.6 ? 'gold' : ENV_PRIZES[Math.floor(R() * ENV_PRIZES.length)] } : null; }
    case 'qbox': { const a = envAir(C, 36, 150, WW - 150, 130, WH * 0.6); return a ? { t: k, id, x: a.x, y: a.y, life: 6 } : null; }
    case 'boss': { const dir = R() < 0.5 ? -1 : 1; return { t: k, id, x: dir > 0 ? -120 : WW + 120, y: 120, dir, sp: Math.round(WW / 6), hp: 150, hpMax: 150, life: 99 }; }
  }
  return null;
}
function envAnchor(o) { // 글자를 띄울 자리
  switch (o.t) { case 'bridge': return [(o.x1 + o.x2) / 2, o.y - 40]; case 'hole': return [o.ax, o.ay - 50]; case 'gust': return [0, o.y - 50]; case 'ice': return [(o.x1 + o.x2) / 2, 0];
    case 'meteor': return [o.x, 140]; case 'tide': return [0, 0]; default: return [o.x, o.y - 60]; }
}
// 차례가 바뀔 때 한 번 — 환경 요소 움직이기·터뜨리기·새로 생기기. 포탄을 쏘면 true
function envTurn(st, C, twCount) {
  const R = C.R, rand = (a, b) => a + R() * (b - a), WW = C.WW, WH = C.WH; let fired = false;
  const shoot = o => { C.spawn(o); fired = true; };
  const cx = x => envClamp(x, 120, WW - 120);
  for (const o of st.list) {
    if (o.gone) continue; o.age = (o.age || 0) + 1;
    switch (o.t) {
      case 'cloud':
        o.x = envClamp(o.x + (C.wind || 0) * 1.2 + o.vx, 80, WW - 80); o.cd--;
        if (o.cd === 1) C.text(o.x, o.y + 70, '⚡ 다음 차례에 번개!', '#fff27a', 20);
        if (o.cd <= 0) { o.cd = 3; shoot({ x: o.x + rand(-30, 30), y: o.y + 34, vx: 0, vy: 1400, w: 'bolt' }); C.text(o.x, o.y + 70, '⚡ 콰르릉!', '#fff27a', 26); }
        break;
      case 'meteor':
        if (o.age >= 1) { const n = 3 + Math.floor(R() * 3); for (let i = 0; i < n; i++) shoot({ x: o.x + rand(-260, 260) - o.dir * 380, y: -80 - rand(0, 260), vx: o.dir * rand(170, 260), vy: rand(220, 360), w: 'meteor' });
          C.text(cx(o.x), 150, '☄️ 운석이 떨어져요!', '#ffb38a', 26); o.life = 0; }
        break;
      case 'volcano':
        o.cd--; if (o.cd === 1) C.text(o.x, o.y - 70, '🌋 화산이 꿈틀거려요…', '#ffb38a', 20);
        if (o.cd <= 0) { o.cd = 2; const n = 6 + Math.floor(R() * 3); for (let i = 0; i < n; i++) shoot({ x: o.x + rand(-8, 8), y: o.y - 16, vx: rand(-330, 330), vy: rand(-820, -460), w: 'lava' }); C.text(o.x, o.y - 70, '🌋 펑! 화산 분출!', '#ff7a3d', 26); }
        break;
      case 'tide': { if (st.water == null) st.water = WH - 8; const lim = Math.round(WH * 0.55); if (st.water > lim) { st.water = Math.max(lim, st.water - o.step); C.text(cx(WW / 2), st.water - 60, o.first ? '🌊 밀물이 들어와요! 높은 곳으로!' : '🌊 물이 또 차올라요!', '#bfe9ff', 24); } o.first = 0; break; }
      case 'balloon': o.x = envClamp(o.x + (C.wind || 0) * 0.9 + o.vx, 60, WW - 60); break;
      case 'boss': o.x += o.dir * o.sp; if (o.x < -180 || o.x > WW + 180) { o.life = 0; C.text(cx(o.x), o.y + 60, '👑 보스 비행선이 떠났어요', '#ffe08a', 20); } break;
    }
    if (o.t !== 'boss') o.life--;
  }
  for (const o of st.list) if (!o.gone && o.life <= 0) { o.gone = true; if (o.t === 'bridge') C.clear(o.x1, o.y - 1, o.x2, o.y + o.th + 1); }
  st.list = st.list.filter(o => !o.gone);
  // 새 환경 요소
  if (st.list.length + (twCount || 0) < 3 && R() < 0.25) {
    const pool = envPool(C.kind).filter(([k]) => !(ENV_ONE.includes(k) && st.list.some(o => o.t === k)));
    const tot = pool.reduce((a, b) => a + b[1], 0); let x = R() * tot, k = pool[0][0]; for (const [kk, wt] of pool) { x -= wt; if (x <= 0) { k = kk; break; } }
    const o = envMake(k, st, C);
    if (o) {
      st.list.push(o); if (k === 'bridge') C.fill(o.x1, o.y, o.x2, o.y + o.th);
      if (k === 'tide' && st.water == null) st.water = WH - 8;
      const [ax, ay] = envAnchor(o); const msg = { cloud: '⚡ 번개 구름 등장! 3차례마다 번개', meteor: '☄️ 운석 경보! 다음 차례에 운석이 떨어져요', bridge: '🌈 무지개 다리! 2차례 뒤 사라져요', hole: '🌀 블랙홀 한 쌍! 들어간 포탄은 다른 구멍으로', gust: '💨 돌풍 띠! 이 높이를 지나는 포탄은 크게 밀려요', crystal: '🪞 반사 수정! 맞으면 포탄이 튕겨요 (3번)', tide: '🌊 밀물 시작! 물이 점점 차올라요', volcano: '🌋 화산 등장! 2차례마다 용암 분출', ice: '🧊 빙판! 미끄럽고 폭발에 잘 밀려요', balloon: '🎁 황금 풍선! 맞히면 큰 보상', qbox: '❓ 퀴즈 상자! 맞히고 문제를 풀면 강한 무기', boss: '👑 보스 비행선! 격추하면 500G' }[k];
      C.text(ax || cx(WW / 2), Math.max(130, ay || 200), msg, '#ffffff', 22);
    }
  }
  return fired;
}
// 포탄이 한 걸음 움직일 때: 0 없음, 1 그 자리에서 터짐, 2 튕김·순간이동, 3 물에 빠짐
function envStep(p, h, st, on) {
  if (!st) return 0;
  if (p.envCd) p.envCd = Math.max(0, p.envCd - h);
  for (const o of st.list) {
    if (o.gone) continue;
    switch (o.t) {
      case 'gust': if (Math.abs(p.y - o.y) < o.hh) p.vx += o.dir * o.pow * h; break;
      case 'hole': if (!p.envCd) { let dx = null, dy = null; if (Math.hypot(p.x - o.ax, p.y - o.ay) < 26) { dx = o.bx; dy = o.by; } else if (Math.hypot(p.x - o.bx, p.y - o.by) < 26) { dx = o.ax; dy = o.ay; }
          if (dx !== null) { const sp = Math.hypot(p.vx, p.vy) || 1; p.x = dx + p.vx / sp * 30; p.y = dy + p.vy / sp * 30; p.envCd = 0.4; if (on) on('hole', o, p); return 2; } } break;
      case 'crystal': { const ddx = p.x - o.x, ddy = p.y - o.y, d = Math.hypot(ddx, ddy);
        if (d < o.r && !p.envCd) { const nx = ddx / (d || 1), ny = ddy / (d || 1), dot = p.vx * nx + p.vy * ny; if (dot < 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; } p.x = o.x + nx * (o.r + 2); p.y = o.y + ny * (o.r + 2); p.envCd = 0.12; o.hp--; if (o.hp <= 0) o.gone = true; if (on) on(o.gone ? 'crack' : 'refl', o, p); return 2; } break; }
      case 'balloon': case 'qbox': if (Math.hypot(p.x - o.x, p.y - o.y) < 26) return 1; break;
      case 'boss': if (Math.abs(p.x - o.x) < 80 && Math.abs(p.y - o.y) < 30) return 1; break;
    }
  }
  if (st.water != null && p.y > st.water + 6) return 3;
  return 0;
}
// 폭발이 환경 요소에 닿았을 때 (풍선·퀴즈 상자·보스)
function envBlast(st, x, y, r, dmg, owner, on) {
  if (!st || !owner || owner.env) return;
  for (const o of st.list) {
    if (o.gone) continue;
    if ((o.t === 'balloon' || o.t === 'qbox') && Math.hypot(o.x - x, o.y - y) < r + 26) { o.gone = true; on(o.t, o, owner); }
    else if (o.t === 'boss') { const d = Math.hypot(o.x - x, o.y - y); if (d < r + 70) { const dd = Math.max(8, Math.round(dmg * (1 - Math.max(0, d - 40) / (r + 70) * 0.6))); o.hp -= dd; on('bossHit', o, owner, dd); if (o.hp <= 0) { o.gone = true; on('bossDown', o, owner); } } }
  }
}
function envOnIce(st, t) { if (!st) return false; for (const o of st.list) if (o.t === 'ice' && !o.gone && t.x >= o.x1 && t.x <= o.x2) return true; return false; }
function envView(st) { return st ? { list: st.list.filter(o => !o.gone).map(o => Object.assign({}, o)), water: st.water, gas: (st.gas || []).map(o => Object.assign({}, o)) } : null; }

// ── 유도 미사일: 떨어지는 중에 적 탱크 반경 HOMING_R 안으로 들어오면 그 탱크를 향해 꺾여 날아감 (지형에 부딪히면 그 자리에서 터짐)
const HOMING_R = 130;
function homingStep(p, h, tanks, teamMode, onLock) {
  if (p.w !== 'homing') return false;
  if (!p.lock) {
    if (p.vy <= 0 || p.age < 0.25) return false;
    let best = null, bd = HOMING_R;
    for (const t of tanks) { if (!t.alive || t === p.owner || (teamMode && p.owner && t.team === p.owner.team)) continue; const d = Math.hypot(p.x - t.x, p.y - (t.y - 10)); if (d < bd) { bd = d; best = t; } }
    if (!best) return false; p.lock = best; if (onLock) onLock(p, best);
  }
  const t = p.lock; if (!t.alive) { p.lock = null; p.w = 'homing0'; return false; }
  const dx = t.x - p.x, dy = (t.y - 10) - p.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(340, Math.hypot(p.vx, p.vy));
  const k = Math.min(1, h * 9); p.vx += (dx / d * sp - p.vx) * k; p.vy += (dy / d * sp - p.vy) * k;
  p.x += p.vx * h; p.y += p.vy * h; p.age += h; return true;
}

// ── 독가스탄·화염 폭탄: 떨어진 자리에 독구름/불길이 여러 차례 남음 (쏜 사람은 안 다침)
//   피해 시점: ① 떨어질 때 그 안에 있던 탱크에 기본 피해  ② 그 뒤로는 '피해 받을 사람이 플레이하는 차례'에만,
//   차례 시작 때 안에 있거나 움직이다 들어가면 → 한 구름(불길)당 한 차례에 한 번만 피해. 시간을 끈다고 피해가 늘지 않음.
//   독구름은 바람·돌풍 띠·회오리에 크게 밀리고, 불길은 바람에 조금만 밀림
const GAS = { gasS: { r: 70, dmg: 8, life: 6 }, gasM: { r: 90, dmg: 11, life: 8 }, gasL: { r: 115, dmg: 14, life: 10 },
  fire: { fire: 1, w: 100, dmg: 10, life: 10 } };
function gasNew(st, kind, x, y, oi, surf) {
  const g = GAS[kind]; if (!g || !st) return null; st.gas = st.gas || []; st.seq = st.seq || 1;
  const o = g.fire ? { id: 'g' + (st.seq++), q: kind, fire: 1, x: Math.round(x), y: Math.round(surf ? surf(x) : y), w: g.w, dmg: g.dmg, life: g.life, max: g.life, oi, hit: {} }
                   : { id: 'g' + (st.seq++), q: kind, x: Math.round(x), y: Math.round(y - g.r * 0.35), r: g.r, dmg: g.dmg, life: g.life, max: g.life, oi, hit: {} };
  st.gas.push(o); return o;
}
function gasIn(o, t) { if (o.fire) return Math.abs(t.x - o.x) < o.w + 8 && t.y > o.y - 60 && t.y < o.y + 70; return Math.hypot(t.x - o.x, (t.y - 10) - o.y) < o.r + 10; }
// 차례가 바뀔 때: 움직이고 줄어들기만 함 (피해 없음)
function gasTurn(st, C, twisters, surf) {
  if (!st) return; st.turnNo = (st.turnNo || 0) + 1; if (!st.gas || !st.gas.length) return;
  for (const o of st.gas) {
    if (o.fire) { o.x += (C.wind || 0) * 0.12; if (surf) o.y = surf(o.x); }
    else {
      o.x += (C.wind || 0) * 0.6;                                                                                   // 바람 (강풍일수록 멀리)
      for (const e of st.list) if (e.t === 'gust' && !e.gone && Math.abs(o.y - e.y) < e.hh + o.r * 0.5) o.x += e.dir * 110;   // 돌풍 띠
      for (const t of (twisters || [])) if (Math.abs(t.x - o.x) < t.w + o.r + 40) { o.x += (t.x - o.x) * 0.7; o.y = Math.max(90, o.y - 45); }  // 회오리
    }
    o.x = Math.round(o.x); o.y = Math.round(o.y); o.life--;
    if (o.x < -(o.r || o.w) || o.x > C.WW + (o.r || o.w)) o.life = 0;
  }
  st.gas = st.gas.filter(o => o.life > 0);
}
// 탱크 i가 구름/불길에 닿았는지 → 피해 목록. land=true면 떨어질 때(기본 피해)
function gasHits(st, tanks, onlyI, land, gasOnly) {
  const out = []; if (!st || !st.gas) return out; const no = st.turnNo || 0;
  for (const o of (gasOnly ? [gasOnly] : st.gas)) tanks.forEach((t, i) => {
    if (!t.alive || i === o.oi || (onlyI !== undefined && onlyI !== null && i !== onlyI)) return;
    if (!land && o.hit[i] === no) return;
    if (gasIn(o, t)) { o.hit[i] = no; out.push({ t, i, o, d: o.dmg }); }
  });
  return out;
}
function gasLabel(o) { return (o.fire ? '🔥 불길 -' : '☠ 독가스 -') + o.dmg; }
