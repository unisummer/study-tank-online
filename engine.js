/* =========================================================
   공부하는 탱크 — 공용 엔진 (서버와 휴대폰이 같이 씀)
   - 씨앗 번호 하나로 똑같은 맵을 만든다 (그림 기능 없이 계산만)
   - 서버는 이 엔진으로 포탄·폭발·피해·낙하·보급 상자·컴퓨터 탱크를 계산하고,
     휴대폰은 그 결과(사건 목록 + 위치 기록)를 받아 그대로 보여 준다.
   - 혼자 하기 게임(index.html)의 물리 코드를 그대로 옮겨 왔다.
   ========================================================= */
(function (root) {
'use strict';
const GRAV = 520, VMAX = 950, WINDMAX = 150;
const WSTAT = {
  basic: { dmg: 30, r: 30 }, scatter: { dmg: 17, r: 22 }, big: { dmg: 48, r: 56 }, dig: { dmg: 8, r: 78 },
  mirv: { dmg: 20, r: 26 }, roller: { dmg: 34, r: 34 }, dirtS: { dmg: 0, r: 36, dirt: 1 }, dirt: { dmg: 0, r: 62, dirt: 1 },
  dirtL: { dmg: 0, r: 105, dirt: 1 }, triple: { dmg: 24, r: 34 }, leap: { dmg: 22, r: 30 }, napalm: { dmg: 9, r: 16 },
  air: { dmg: 20, r: 30 }, death: { dmg: 28, r: 44 }, nuke: { dmg: 90, r: 430 }, mirvc: { dmg: 20, r: 26 },
  deathc: { dmg: 28, r: 44 }, airb: { dmg: 20, r: 30 }, napf: { dmg: 9, r: 16 }, tri2: { dmg: 24, r: 46 }, tri3: { dmg: 26, r: 60 },
};
const SUPER = ['triple', 'leap', 'napalm', 'air', 'death', 'nuke', 'dirtL'];
const MAPKEYS = ['hills', 'sky', 'canyon', 'towers', 'scorched', 'donuts', 'sphinx', 'logbridge', 'island', 'grave', 'wisland', 'wcave', 'cheese'];
const CRATE_POOL = [['nuke', 1], ['death', 2], ['air', 3], ['triple', 3], ['napalm', 3], ['leap', 3], ['dirtL', 2], ['gold', 3], ['repair', 2]];
const HEAL = { repairS: 15, repair: 20, repairL: 25 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

// 씨앗 번호로 같은 난수가 나오게 (mulberry32)
function rng(seed) { let a = seed >>> 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/*EXTRA_MAPS_BEGIN — maps_extra.js에서 복사됨 (build.py가 맞춰 줌)*/
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
function twisterStep(p, h, list, rand, onEvt) {
  if (!list || !list.length) return false;
  if (p.tw) {
    const t = list.find(o => o.id === p.tw.id); if (!t) { p.tw = null; return false; }
    p.tw.a += 11 * h; p.y -= 430 * h; const r = 8 + Math.max(0, (t.base - p.y) / t.h) * t.w; p.x = t.x + Math.sin(p.tw.a) * r;
    if (p.y <= t.base - t.h) {
      p.tw = null; (p.twUsed || (p.twUsed = {}))[t.id] = 1;
      if (t.fire) { p.vx = rand(-470, 470); p.vy = rand(-430, -60); p.dmgX = 2; if (onEvt) onEvt('fire_out', p); }
      else { p.vx = rand(-80, 80); p.vy = rand(-170, -40); if (onEvt) onEvt('wind_out', p); }
    }
    return true;
  }
  for (const t of list) {
    if (p.twUsed && p.twUsed[t.id]) continue;
    const k = (t.base - p.y) / t.h;
    if (k > 0 && k < 1 && Math.abs(p.x - t.x) < t.w * (0.35 + 0.65 * k)) { p.tw = { id: t.id, a: 0 }; if (onEvt) onEvt(t.fire ? 'fire_in' : 'wind_in', p); return true; }
  }
  return false;
}
/*EXTRA_MAPS_END*/
/* ---------- 맵 만들기 (재료: 1 흙, 2 돌, 3 나무 발판) ---------- */
function genWorld(seed, kind, nTanks) {
  const R = rng(seed); const rand = (a, b) => a + R() * (b - a);
  if (!MAPKEYS.includes(kind)) kind = MAPKEYS[Math.floor(R() * MAPKEYS.length)];
  const themeIdx = Math.floor(R() * 4);
  nTanks = nTanks || 4;
  const WW = Math.round(clamp(1800 + nTanks * 400, 2600, 5000)), WH = 1300;
  const mat = new Uint8Array(WW * WH);
  const col = (x, y0, y1, m) => { x |= 0; if (x < 0 || x >= WW) return; y0 = Math.max(0, Math.ceil(y0)); y1 = Math.min(WH - 1, Math.floor(y1)); for (let y = y0; y <= y1; y++) mat[y * WW + x] = m; };
  const rect = (x, y, w, h, m) => { for (let xx = Math.max(0, Math.round(x)); xx < Math.min(WW, Math.round(x + w)); xx++) col(xx, y, y + h - 1, m); };
  const ellipse = (cx, cy, rx, ry, m) => { for (let xx = Math.ceil(cx - rx); xx <= cx + rx; xx++) { const dx = (xx - cx) / rx; const h = ry * Math.sqrt(Math.max(0, 1 - dx * dx)); col(xx, cy - h, cy + h, m); } };
  const plank = (x, y, w, h) => rect(x, y, w, h, 3);
  let valleys = [];
  if (kind === 'hills') {
    const p = [rand(0, 6), rand(0, 6), rand(0, 6), rand(0, 6)];
    for (let x = 0; x < WW; x++) col(x, WH * 0.6 + Math.sin(x / 300 + p[0]) * 130 + Math.sin(x / 120 + p[1]) * 45 + Math.sin(x / 47 + p[2]) * 12 + Math.sin(x / 700 + p[3]) * 90, WH - 1, 1);
    const k = Math.round(WW / 900); for (let i = 0; i < k; i++) { const cx = (i + 0.5) / k * WW + rand(-150, 150), cy = WH * rand(0.22, 0.4); ellipse(cx, cy, rand(90, 160), rand(24, 40), 1); }
    for (let i = 0; i < 2; i++) plank(rand(0.1, 0.8) * WW, WH * rand(0.3, 0.45), rand(160, 260), 22);
  } else if (kind === 'sky') {
    [0.24, 0.42, 0.6, 0.78].forEach((ly, li) => {
      let x = rand(0, 180) + li * 60;
      while (x < WW - 120) {
        const w = rand(220, 480), y = WH * ly + rand(-35, 35);
        if (R() < 0.3) { const D = rand(70, 120) * 0.5; for (let xx = Math.round(x); xx < x + w; xx++) { const t = (xx - x) / w; col(xx, y, y + Math.max(14, D * 4 * t * (1 - t)), 1); } }
        else plank(x, y, w, rand(20, 26));
        x += w + rand(110, 240);
      }
    });
  } else if (kind === 'canyon') {
    const nm = WW > 3600 ? 3 : 2; const gap = WW * 0.16; const mw = (WW - gap * (nm - 1)) / nm;
    for (let m = 0; m < nm; m++) {
      const x0 = m * (mw + gap), x1 = x0 + mw, top = WH * rand(0.32, 0.48);
      for (let x = Math.ceil(x0); x <= x1; x++) { const edge = Math.min(x - x0, x1 - x); const drop = edge < 60 ? (60 - edge) * 2 : 0; col(x, top + Math.sin(x / 90 + m) * 25 + Math.sin(x / 37) * 8 + drop + (Math.abs(x - (x0 + x1) / 2) < mw * 0.18 ? -60 : 0), WH - 1, 1); }
      if (m < nm - 1) { plank(x1 - 20, top + rand(-10, 30), gap + 40, 18); rect(x1 + gap * 0.3, WH * rand(0.6, 0.7), gap * 0.4, 24, 2); }
    }
  } else if (kind === 'scorched') {
    const k = nTanks, seg = WW / k; const pts = [[0, WH * rand(0.1, 0.25)]];
    for (let i = 0; i < k; i++) { const vx = (i + 0.5) * seg + rand(-seg * 0.15, seg * 0.15), vy = WH * rand(0.74, 0.88); valleys.push(vx); pts.push([vx, vy]); pts.push([Math.min(WW, (i + 1) * seg + rand(-seg * 0.08, seg * 0.08)), WH * rand(0.08, 0.3)]); }
    pts[pts.length - 1][0] = WW;
    const ph = [rand(0, 6), rand(0, 6)];
    let j = 0;
    for (let x = 0; x < WW; x++) { while (j < pts.length - 2 && pts[j + 1][0] < x) j++; const [x0, y0] = pts[j], [x1, y1] = pts[j + 1]; const t = clamp((x - x0) / Math.max(1, x1 - x0), 0, 1); const e = (1 - Math.cos(t * Math.PI)) / 2; col(x, y0 + (y1 - y0) * e + Math.sin(x / 37 + ph[0]) * 9 + Math.sin(x / 13 + ph[1]) * 4, WH - 1, 1); }
    for (let i = 0; i < k; i++) if (R() < 0.6) { const x = (i + 1) * seg + rand(-60, 60); rect(x - rand(80, 140), WH * rand(0.35, 0.55), rand(90, 160), 22, 2); }
  } else if (['sphinx', 'logbridge', 'island', 'grave', 'wisland', 'wcave', 'cheese'].includes(kind)) {
    paintExtraMap(kind, WW, WH, nTanks, rand, R, col, rect, ellipse, plank, valleys);
  } else if (kind === 'donuts') {
    // 도넛 섬: 하늘에 도넛 모양 땅이 잔뜩, 탱크는 저마다 도넛 안에서 시작 (껍질을 부숴야 밖으로 쏠 수 있음)
    const rings = []; const ok = (cx, cy, ro) => rings.every(o => Math.hypot(o.cx - cx, o.cy - cy) > o.ro + ro + 36);
    const seg = WW / nTanks;
    for (let i = 0; i < nTanks; i++) { for (let tries = 0; tries < 40; tries++) { const ro = rand(118, 158), cx = clamp((i + 0.5) * seg + rand(-seg * 0.2, seg * 0.2), ro + 30, WW - ro - 30), cy = WH * rand(0.2, 0.66); if (ok(cx, cy, ro) || tries === 39) { rings.push({ cx, cy, ro, t: rand(30, 40), spawn: true }); break; } } }
    const extra = Math.round(WW / 520);
    for (let i = 0; i < extra * 6 && rings.filter(r => !r.spawn).length < extra; i++) { const ro = rand(70, 140), cx = rand(ro + 20, WW - ro - 20), cy = WH * rand(0.12, 0.74); if (ok(cx, cy, ro)) rings.push({ cx, cy, ro, t: rand(24, 36), spawn: false }); }
    for (const r of rings) {
      const ri = r.ti = r.ro - r.t, floorY = r.cy + ri - 14;
      for (let x = Math.ceil(r.cx - r.ro); x <= r.cx + r.ro; x++) {
        const dx = x - r.cx, ho = Math.sqrt(Math.max(0, r.ro * r.ro - dx * dx)), hi = Math.abs(dx) < ri ? Math.sqrt(ri * ri - dx * dx) : -1;
        if (hi < 0) col(x, r.cy - ho, r.cy + ho, 1);
        else { col(x, r.cy - ho, r.cy - hi, 1); col(x, Math.min(r.cy + hi, floorY), r.cy + ho, 1); }
      }
      if (r.spawn) valleys.push({ x: Math.round(r.cx), y: Math.round(floorY) - 1 });
    }
    // 아래는 물 — 떨어지면 탈락
  } else { // towers
    const gy = WH * 0.84; let x = 0;
    while (x < WW) { const w = rand(380, 700); for (let xx = Math.round(x); xx <= Math.min(WW - 1, x + w); xx++) col(xx, gy + Math.sin(xx / 80) * 14, WH - 1, 1); x += w + rand(140, 230); }
    const k = Math.round(WW / 520);
    for (let i = 0; i < k; i++) {
      const tx = (i + 0.5) / k * WW + rand(-60, 60), tw = rand(70, 110), th2 = rand(260, 640), ty = gy - th2;
      rect(tx - tw / 2, ty, tw, th2 + 60, 2);
      for (let y = ty + 40; y < gy - 90; y += rand(130, 180)) { const side = R() < 0.5 ? -1 : 1; const pw = rand(120, 200); plank(side < 0 ? tx - tw / 2 - pw : tx + tw / 2, y, pw, 20); }
      if (i < k - 1 && R() < 0.6) { const nx = (i + 1.5) / k * WW; plank(tx + tw / 2, ty + rand(0, 60), Math.max(60, nx - tx - tw), 18); }
    }
  }
  const bedrockY = (kind === 'hills' || kind === 'scorched' || kind === 'sphinx') ? WH - 40 : 99999;
  if (bedrockY < WH) rect(0, bedrockY, WW, WH - bedrockY, 2);
  const solid = new Uint8Array(WW * WH); for (let i = 0; i < mat.length; i++) solid[i] = mat[i] ? 1 : 0;
  return { WW, WH, mat, solid, kind, valleys, bedrockY, themeIdx, seed, nukeR: Math.round(WW / 6), R };
}

/* ---------- 땅 다루기 (혼자 하기의 carve/addDirt와 같은 계산) ---------- */
function isSolidW(w, x, y) { x |= 0; y |= 0; if (x < 0 || x >= w.WW || y < 0 || y >= w.WH) return false; return w.solid[y * w.WW + x] === 1; }
function carveW(w, cx, cy, r) {
  const WW = w.WW, x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(WW - 1, (cx + r) | 0), y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(w.WH - 1, w.bedrockY - 1, (cy + r) | 0), r2 = r * r;
  for (let y = y0; y <= y1; y++) { const dy = y - cy, row = y * WW; for (let x = x0; x <= x1; x++) { const dx = x - cx; if (dx * dx + dy * dy <= r2) w.solid[row + x] = 0; } }
}
function dirtW(w, cx, cy, r) {
  const WW = w.WW, x0 = Math.max(0, (cx - r) | 0), x1 = Math.min(WW - 1, (cx + r) | 0), y0 = Math.max(0, (cy - r) | 0), y1 = Math.min(w.WH - 1, (cy + r) | 0), r2 = r * r;
  for (let y = y0; y <= y1; y++) { const dy = y - cy; for (let x = x0; x <= x1; x++) { const dx = x - cx; if (dx * dx + dy * dy <= r2) w.solid[y * WW + x] = 1; } }
}
function standSpots(w) { const out = [], s = (x, y) => isSolidW(w, x, y); for (let x = 50; x < w.WW - 50; x += 14) { for (let y = 45; y < w.WH - 40; y++) { if (s(x, y) && !s(x, y - 1) && !s(x, y - 24) && !s(x, y - 44) && (s(x - 8, y + 2) || s(x + 8, y + 2))) out.push({ x, y: y - 1 }); } } return out; }
function shuffleR(a, R) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function surfaceYW(w, x) { for (let y = 0; y < w.WH; y++) if (isSolidW(w, x, y)) return y; return w.WH + 50; }
function pickSpawns(w, n, R) {
  if (w.kind === 'wcave') { // 동굴 바닥 찾기: 동굴 가운데 높이에서 아래로 내려가 처음 닿는 땅
    const c = []; for (const v of w.valleys) { const y0 = Math.round(w.WH * 0.36); if (isSolidW(w, v.x, y0)) continue; let y = y0; while (y < w.WH - 2 && !isSolidW(w, v.x, y + 1)) y++; if (y < w.WH - 2) c.push({ x: v.x, y }); }
    if (c.length >= n) { const st = c.length / n; return shuffleR([...Array(n)].map((_, i) => c[Math.floor(i * st + st / 2)]), R); } }
  if (w.kind === 'donuts' && w.valleys.length >= n) return shuffleR(w.valleys.slice(0, n).map(v => ({ x: v.x, y: v.y })), R);
  if (w.kind === 'scorched' && w.valleys.length >= n) return shuffleR(w.valleys.slice(0, n).map(vx => { const x = Math.round(vx); return { x, y: surfaceYW(w, x) - 1 }; }), R);
  const spots = shuffleR(standSpots(w), R); let minD = w.WW / (n + 0.5) * 0.85; const res = [];
  while (res.length < n && minD > 20) { res.length = 0; for (const s0 of spots) { if (res.every(r => Math.hypot(r.x - s0.x, (r.y - s0.y) * 0.8) > minD)) res.push(s0); if (res.length >= n) break; } minD *= 0.85; }
  while (res.length < n) res.push(spots[Math.floor(R() * spots.length)] || { x: w.WW / 2, y: 100 });
  return shuffleR(res, R);
}

/* =========================================================
   대전 계산 (서버가 돌림)
   tank: {i, uid, name, team, isAI, x, y, hp, hpMax, alive, angle, dmgMul, shield, rainbow, chute, spider, ...}
   ========================================================= */
function makeSim(w, tanks, opts) {
  opts = opts || {};
  const WW = w.WW, WH = w.WH;
  const isSolid = (x, y) => isSolidW(w, x, y);
  const R = Math.random;
  const rand = (a, b) => a + R() * (b - a);
  const S = { w, tanks, wind: 0, crates: [], crateSeq: 1, deathSeq: 0, teamMode: !!opts.teamMode, t: 0, ev: null, proj: null, delayed: null, gold: {} };
  const sameTeam = (a, b) => a && b && a.team === b.team;
  WSTAT.nuke.r = w.nukeR;
  // 사건 기록
  const E = (o) => { if (S.ev) { o.t = +S.t.toFixed(3); S.ev.push(o); } };
  const text = (x, y, s, c, size) => E({ e: 'text', x: Math.round(x), y: Math.round(y), s, c: c || '#fff', z: size || 16 });
  const goldFor = (t, label, amt) => { if (!t || t.isAI || amt <= 0) return; const g = S.gold[t.i] || (S.gold[t.i] = {}); g[label] = (g[label] || 0) + amt; E({ e: 'gold', i: t.i, l: label, a: amt }); };
  S.goldFor = goldFor;

  function muzzle(t, a) { const r = t.rot || 0; return { x: t.x + Math.sin(r) * 4 + Math.cos(a) * 22, y: t.y - 10 - Math.cos(r) * 4 + Math.sin(a) * 22 }; }
  function tankHit(p) { for (const t of tanks) { if (!t.alive) continue; if (t === p.owner && p.age < 0.3) continue; if (Math.hypot(p.x - t.x, p.y - (t.y - 10)) < 18) return t; } return null; }
  function surfaceAt(x, y0) { let y = y0 - 20; while (y < WH && !isSolid(x, y)) y++; return y; }
  function coverMul(x0, y0, x1, y1) { const L = Math.hypot(x1 - x0, y1 - y0); if (L < 20) return 1; const n = Math.floor(L / 4); let sol = 0, tot = 0; for (let i = 0; i <= n; i++) { const d = i * 4; if (d < 6 || d > L - 14) continue; tot++; if (isSolid(x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L)) sol++; } return tot ? 1 - 0.7 * (sol / tot) : 1; }

  function hurt(t, dmg, src, cov) {
    if (!t.alive || dmg <= 0) return;
    if (t.rainbow > 0) { t.rainbow--; E({ e: 'hit', i: t.i, d: 0, rb: t.rainbow }); return; }
    let sh = 0; if (t.shield) { dmg *= 0.5; t.shield = false; sh = 1; }
    dmg = Math.min(t.hp, Math.max(1, Math.round(dmg))); t.hp -= dmg;
    E({ e: 'hit', i: t.i, d: dmg, sh, cov: cov !== undefined && cov < 0.8 ? Math.round((1 - cov) * 100) : 0, hp: t.hp });
    if (src && src !== t) { if (sameTeam(src, t) && S.teamMode) { E({ e: 'ff', i: t.i, by: src.i }); } else { t.lastHit = src; src.dmgDealt = (src.dmgDealt || 0) + dmg; goldFor(src, '피해 보상', dmg); } }
    if (t.hp <= 0) killTank(t);
  }
  function killTank(t, why) {
    t.alive = false; t.hp = 0; S.deathSeq++; t.deathOrder = S.deathSeq;
    const k = t.lastHit; if (k && k !== t) { k.kills = (k.kills || 0) + 1; k.roundKills = (k.roundKills || 0) + 1; goldFor(k, '처치', 100); if ((t.roundKills || 0) >= 2) goldFor(k, '현상금', t.roundKills * 50); }
    E({ e: 'kill', i: t.i, by: k ? k.i : -1, why: why || '' });
  }
  S.killTank = killTank;

  /* ---- 보급 상자 ---- */
  function rollCrate() { const tot = CRATE_POOL.reduce((a, b) => a + b[1], 0); let x = R() * tot; for (const [k, wt] of CRATE_POOL) { x -= wt; if (x <= 0) return k; } return 'gold'; }
  S.dropCrate = function () {
    let x = Math.round(rand(150, WW - 150)), y = 0; if (w.kind === 'wcave') { for (let k = 0; k < 20 && isSolid(x, WH * 0.36); k++) x = Math.round(rand(150, WW - 150)); y = Math.round(WH * 0.36); } while (y < WH && !(isSolid(x, y + 1) || isSolid(x - 10, y + 1) || isSolid(x + 10, y + 1))) y++;
    if (y >= WH - 2) return null;
    const c = { id: S.crateSeq++, x, y, item: rollCrate() }; S.crates.push(c); return c;
  };
  function giveCrate(c, t) {
    c.gone = true; const k = c.item;
    if (k === 'gold') goldFor(t, '보급 상자', 150);
    else if (k === 'repair') { if (t.isAI) t.hp = Math.min(t.hpMax, t.hp + 20); }
    else if (t.isAI && t.ammo) t.ammo[k] = (t.ammo[k] || 0) + 1;
    E({ e: 'crate', id: c.id, i: t.i, item: k });
  }
  S.giveCrate = giveCrate;
  function hitCrates(x, y, r, owner) { for (const c of S.crates) if (!c.gone && Math.hypot(c.x - x, c.y - 12 - y) < r && owner && owner.alive) giveCrate(c, owner); }
  S.touchCrates = function (t) { for (const c of S.crates) if (!c.gone && t.alive && Math.hypot(t.x - c.x, (t.y - 10) - (c.y - 12)) < 30) { const ev = S.ev; S.ev = S.ev || []; giveCrate(c, t); const out = S.ev; S.ev = ev; S.crates = S.crates.filter(c => !c.gone); return out; } return null; };
  function crateFall() { for (const c of S.crates) { if (c.gone) continue; let k = 0; while (k < 3 && !(isSolid(c.x, c.y + 1) || isSolid(c.x - 10, c.y + 1) || isSolid(c.x + 10, c.y + 1))) { c.y++; k++; } if (c.y > WH + 20) { c.gone = true; E({ e: 'crate_gone', id: c.id }); } for (const t of tanks) if (t.alive && Math.hypot(t.x - c.x, (t.y - 10) - (c.y - 12)) < 30) { giveCrate(c, t); break; } } S.crates = S.crates.filter(c => !c.gone); }

  /* ---- 포탄 ---- */
  let pid = 1;
  const mkP = (o) => Object.assign({ id: pid++, age: 0, mode: 'fly' }, o);
  // 환경 요소: 회오리
  S.twisters = []; let twSeq = 1;
  const surfTop = x => surfaceYW(w, Math.round(x)) > w.WH ? w.WH : surfaceYW(w, Math.round(x));
  function twEvt(kind, p) { const x = Math.round(p.x), y = Math.round(p.y) - 30;
    if (kind === 'wind_in') E({ e: 'text', x, y, s: '회오리에 휘말렸다!', c: '#e8f4ff', z: 16 });
    else if (kind === 'fire_in') E({ e: 'text', x, y, s: '불꽃 회오리!', c: '#ffb347', z: 18 });
    else if (kind === 'fire_out') E({ e: 'text', x, y, s: '어디로 갈까?!', c: '#ff8a5c', z: 18 }); }
  S.twTurn = function () { const before = S.twisters.length; twisterTurn(S.twisters, WW, surfTop, S.wind || 0, rand, () => twSeq++); return S.twisters.length > before ? S.twisters[S.twisters.length - 1] : null; };
  S.twView = () => S.twisters.map(t => ({ id: t.id, x: Math.round(t.x), base: Math.round(t.base), h: Math.round(t.h), w: t.w, fire: t.fire, life: t.life }));
  function startRoll(p) { let n = 0; while (isSolid(p.x, p.y) && n < 14) { p.y--; n++; } p.mode = 'roll'; p.rollT = 0; const l = surfaceAt(p.x - 12, p.y), r = surfaceAt(p.x + 12, p.y); p.dir = Math.abs(l - r) > 3 ? (l > r ? -1 : 1) : (Math.sign(p.vx) || 1); }
  function updRoll(p, dt) {
    p.rollT += dt; const steps = Math.round((p.rollSpeed || 150) * dt);
    for (let s = 0; s < steps; s++) {
      const nx = p.x + p.dir; let ny = p.y, c = 0; while (isSolid(nx, ny) && c < 4) { ny--; c++; } if (isSolid(nx, ny)) { explode(p); return; }
      p.x = nx; p.y = ny; let f = 0; while (!isSolid(p.x, p.y + 1) && f < 3) { p.y++; f++; }
      if (p.y > WH || p.x < 0 || p.x >= WW) { p.dead = true; return; }
      for (const t of tanks) if (t.alive && t !== p.owner && Math.abs(t.x - p.x) < 18 && Math.abs(t.y - 10 - p.y) < 20) { explode(p); return; }
    }
    if (p.rollT > (p.rollMax || 2.2)) explode(p);
  }
  function updProj(p, dt) {
    if (p.mode === 'roll') return updRoll(p, dt);
    const sp = Math.hypot(p.vx, p.vy); const n = Math.max(1, Math.ceil(sp * dt / 3)); const h = dt / n;
    for (let i = 0; i < n; i++) {
      if (S.twisters.length && twisterStep(p, h, S.twisters, rand, twEvt)) { p.age += h; continue; }
      const pvy = p.vy; p.vx += S.wind * h; p.vy += GRAV * h; p.x += p.vx * h; p.y += p.vy * h; p.age += h;
      if (p.w === 'mirv' && pvy < 0 && p.vy >= 0) { p.w = 'mirvc'; [-2, -1, 1, 2].forEach(k => S.proj.push(mkP({ x: p.x, y: p.y, vx: p.vx + k * 55, vy: p.vy, w: 'mirvc', owner: p.owner, age: 1 }))); E({ e: 'split', x: Math.round(p.x), y: Math.round(p.y), big: 0 }); }
      if (p.w === 'death' && pvy < 0 && p.vy >= 0) { p.w = 'deathc'; for (let k = -5; k <= 5; k++) if (k) S.proj.push(mkP({ x: p.x, y: p.y, vx: p.vx + k * 42, vy: p.vy + rand(-30, 30), w: 'deathc', owner: p.owner, age: 1 })); E({ e: 'split', x: Math.round(p.x), y: Math.round(p.y), big: 1 }); }
      if (p.x < -300 || p.x > WW + 300 || p.y > WH + 60) { p.dead = true; if (p.warp) text(p.owner.x, p.owner.y - 50, '이동 실패 (맵 밖)'); return; }
      if (p.w !== 'napf' && tankHit(p)) { explode(p); return; }
      if (isSolid(p.x, p.y)) { if (p.w === 'roller') { startRoll(p); return; } if (p.w === 'napf') { startRoll(p); p.rollMax = rand(0.4, 1.4); p.rollSpeed = 110; return; } explode(p); return; }
    }
  }
  function warpLand(p) {
    p.dead = true; const o = p.owner; if (!o.alive) return; let x = clamp(p.x, 20, WW - 20), y = Math.min(p.y, WH - 2), k = 0;
    while ((isSolid(x, y - 2) || isSolid(x, y - 24)) && k < 120) { y--; k++; }
    o.x = x; o.y = y; o.vy = 0; o.vx = 0; o.air = true; o.peak = y; o.detachT = 0;
    E({ e: 'warp', i: o.i, x: Math.round(x), y: Math.round(y) });
  }
  function explode(p) {
    if (p.warp) { warpLand(p); return; }
    p.dead = true; const W = WSTAT[p.w];
    hitCrates(p.x, p.y, W.r + 24, p.owner);
    const sub = (wk, o) => mkP(Object.assign({ x: p.x, y: p.y, vx: 0, vy: 0, w: wk, owner: p.owner, age: 1 }, o));
    if (p.w === 'triple') S.delayed.push({ t: 0.35, p: sub('tri2'), boom: 1 }, { t: 0.75, p: sub('tri3'), boom: 1 });
    if (p.w === 'leap') { p.bounce = (p.bounce || 0) + 1; if (p.bounce < 4) { let y = p.y, k = 0; while (isSolid(p.x, y) && k < 30) { y--; k++; } const q = sub('leap', { y: y - 4, vx: clamp(p.vx * 0.7, -260, 260) + rand(-20, 20), vy: -Math.max(260, Math.abs(p.vy) * 0.6) }); q.bounce = p.bounce; q.age = 0.5; S.delayed.push({ t: 0.05, p: q }); } }
    if (p.w === 'napalm') { for (let i = 0; i < 12; i++) { let y = p.y, k = 0; while (isSolid(p.x, y) && k < 30) { y--; k++; } S.delayed.push({ t: 0.02 * i, p: sub('napf', { y: y - 2, x: p.x + rand(-10, 10), vx: rand(-160, 160), vy: rand(-180, -60) }) }); } }
    if (p.w === 'air') { text(p.x, p.y - 60, '하늘 폭격!', '#ffd43b', 26); for (let i = 0; i < 9; i++) S.delayed.push({ t: 0.5 + i * 0.12, p: sub('airb', { x: p.x + (i - 4) * 34 + rand(-12, 12), y: -40 - rand(0, 120), vx: rand(-15, 15), vy: 250 }) }); }
    if (W.dirt) { dirtW(w, p.x, p.y, W.r); E({ e: 'boom', x: +p.x.toFixed(2), y: +p.y.toFixed(2), r: W.r, w: p.w, dirt: 1 }); return; }
    const hits = []; for (const t of tanks) { if (!t.alive) continue; const d = Math.hypot(t.x - p.x, (t.y - 10) - p.y); const Rr = W.r + 14; if (d < Rr) { const f = 1 - Math.max(0, d - 8) / Rr * 0.75; const cov = coverMul(p.x, p.y, t.x, t.y - 10); hits.push([t, W.dmg * f * cov * (p.owner.dmgMul || 1) * (p.dmgX || 1), cov]); } }
    if (p.dmgX > 1 && hits.length) E({ e: 'text', x: Math.round(p.x), y: Math.round(p.y) - 50, s: '🔥 불꽃 피해 2배!', c: '#ff6b3d', z: 22 });
    carveW(w, p.x, p.y, W.r);
    E({ e: 'boom', x: +p.x.toFixed(2), y: +p.y.toFixed(2), r: W.r, w: p.w });
    for (const [t, dmg, cov] of hits) hurt(t, dmg, p.owner, cov);
  }

  /* ---- 탱크 낙하 (혼자 하기 tankPhysics와 같음) ---- */
  function surfNormal(cx, cy, r) { let sx = 0, sy = 0, c = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a); if (isSolid(cx + dx * r, cy + dy * r) || isSolid(cx + dx * r * 0.6, cy + dy * r * 0.6)) { sx += dx; sy += dy; c++; } } if (!c) return null; const L = Math.hypot(sx, sy); if (L < 0.01) return { x: 0, y: -1 }; return { x: -sx / L, y: -sy / L }; }
  function solidNear(cx, cy, r) { for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; if (isSolid(cx + Math.cos(a) * r, cy + Math.sin(a) * r)) return true; } return isSolid(cx, cy); }
  function spiderPhysics(t, dt) {
    t.detachT = Math.max(0, (t.detachT || 0) - dt);
    const cx = t.x, cy = t.y - 10; const n = t.detachT > 0 ? null : surfNormal(cx, cy, 17);
    if (!n) { t.rot = (t.rot || 0) * 0.9; return false; }
    t.air = false; t.chuteOpen = false; t.vx = 0; t.vy = 0; t.nx = n.x; t.ny = n.y;
    const target = Math.atan2(n.x, -n.y); let dr = target - (t.rot || 0); while (dr > Math.PI) dr -= 2 * Math.PI; while (dr < -Math.PI) dr += 2 * Math.PI; t.rot = (t.rot || 0) + dr * Math.min(1, dt * 12);
    let x = cx, y = cy, k = 0; while (solidNear(x, y, 9) && k < 12) { x += n.x; y += n.y; k++; }
    k = 0; while (!solidNear(x, y, 12) && k < 6) { x -= n.x; y -= n.y; k++; }
    t.x = clamp(x, 12, WW - 12); t.y = y + 10; return true;
  }
  function tankPhysics(t, dt) {
    if (!t.alive) return;
    if (t.spider && spiderPhysics(t, dt)) return;
    if (!t.spider) { let n = 0; while (isSolid(t.x, t.y - 2) && n < 120) { t.y--; n++; } t.rot = 0; }
    const grounded = isSolid(t.x, t.y + 1) || isSolid(t.x - 9, t.y + 1) || isSolid(t.x + 9, t.y + 1);
    if (grounded && (t.vy || 0) >= 0) { t.air = false; t.vy = 0; t.vx = 0; t.chuteOpen = false; }
    else {
      if (!t.air) { t.air = true; t.peak = t.y; t.vy = t.vy || 0; t.vx = t.vx || 0; }
      t.vy = Math.min(t.vy + GRAV * dt, 900);
      if (t.chute && t.vy > 0 && t.y - t.peak > 30) { t.chuteOpen = true; t.vy = Math.min(t.vy, 75); const wantVx = S.wind * 0.7; t.vx += (wantVx - t.vx) * Math.min(1, dt * 2); }
      const dy = t.vy * dt; const steps = Math.ceil(Math.abs(dy)); const sy = dy / Math.max(1, steps);
      for (let i = 0; i < steps; i++) { if (sy > 0 && (isSolid(t.x, t.y + 1) || isSolid(t.x - 9, t.y + 1) || isSolid(t.x + 9, t.y + 1))) break; if (sy < 0 && isSolid(t.x, t.y - 24)) { t.vy = 0; break; } t.y += sy; }
      if (t.vy < 0) t.peak = Math.min(t.peak, t.y);
      if (t.vx) { const nx = t.x + t.vx * dt; if (!isSolid(nx, t.y - 6) && !isSolid(nx, t.y - 18)) t.x = nx; else t.vx = 0; }
      if (t.x <= 12 || t.x >= WW - 12) t.vx = 0;
      if (t.y > WH + 30) { text(t.x, WH - 40, '추락!', '#fff', 22); killTank(t, 'fall'); }
    }
    t.x = clamp(t.x, 12, WW - 12);
  }
  S.tankPhysics = tankPhysics;

  /* ---- 한 번의 발사를 끝까지 계산 → 결과 묶음 ---- */
  S.resolveShot = function (shooter, ang, pow, wk, flags) {
    flags = flags || {};
    WSTAT.nuke.r = w.nukeR; S.ev = []; S.proj = []; S.delayed = []; S.t = 0; S.gold = {};
    const frames = [];
    const v = pow / 100 * VMAX; const m = muzzle(shooter, ang);
    const mk = a => mkP({ x: m.x, y: m.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: wk, owner: shooter });
    shooter.angle = ang;
    if (flags.warp) { const pr = mk(ang); pr.w = 'basic'; pr.warp = true; S.proj.push(pr); }
    else if (wk === 'scatter') [-1, 0, 1].forEach(i => S.proj.push(mk(ang + i * 0.085))); else S.proj.push(mk(ang));
    let second = flags.double && !flags.warp ? { delay: 0.45, w: flags.secondW || wk } : null;
    const dt = 1 / 60; let quiet = 0, step = 0;
    const snap = () => {
      frames.push([+S.t.toFixed(3), S.proj.filter(p => !p.dead).map(p => [p.id, Math.round(p.x), Math.round(p.y), p.w, p.mode === 'roll' ? 1 : 0]),
        tanks.map(t => t.alive ? [Math.round(t.x), Math.round(t.y), +(t.rot || 0).toFixed(2), t.chuteOpen ? 1 : 0] : 0)]);
    };
    snap();
    while (S.t < 25) {
      S.t += dt; step++;
      if (second) { second.delay -= dt; if (second.delay <= 0) { if (shooter.alive) { const p = mk(ang); p.w = second.w; S.proj.push(p); E({ e: 'fire2', i: shooter.i }); } second = null; } }
      for (const d of S.delayed) { d.t -= dt; if (d.t <= 0) { d.done = true; if (d.boom) explode(d.p); else S.proj.push(d.p); } }
      S.delayed = S.delayed.filter(d => !d.done);
      for (const p of S.proj) if (!p.dead) updProj(p, dt);
      S.proj = S.proj.filter(p => !p.dead);
      for (const t of tanks) tankPhysics(t, dt);
      crateFall();
      if (step % 3 === 0) snap();
      const busy = S.proj.length || S.delayed.length || second || tanks.some(t => t.alive && t.air);
      quiet = busy ? 0 : quiet + dt;
      if (quiet > 0.4) break;
    }
    snap();
    const out = { dur: +S.t.toFixed(3), frames, ev: S.ev, gold: S.gold };
    S.ev = null; S.proj = null; S.delayed = null;
    return out;
  };

  /* ---- 컴퓨터 탱크 조준 ---- */
  function simulate(t, ang, pow, wind, maxT) {
    const v = pow / 100 * VMAX; const m = muzzle(t, ang); let x = m.x, y = m.y, vx = Math.cos(ang) * v, vy = Math.sin(ang) * v, age = 0; const h = 1 / 120;
    for (let i = 0; i < maxT * 120; i++) {
      vx += wind * h; vy += GRAV * h; x += vx * h; y += vy * h; age += h;
      if (x < -300 || x > WW + 300 || y > WH + 60) return { x, y, out: true };
      if (isSolid(x, y)) return { x, y };
      for (const o of tanks) { if (!o.alive) continue; if (o === t && age < 0.3) continue; if (Math.hypot(x - o.x, y - (o.y - 10)) < 18) return { x, y, hit: o }; }
    }
    return { x, y };
  }
  S.aiPlan = function (t, diff, preferUid) {
    const alive = tanks.filter(o => o.alive);
    const foes = alive.filter(o => o !== t && !(S.teamMode && sameTeam(o, t))); const mates = S.teamMode ? alive.filter(o => o !== t && sameTeam(o, t)) : [];
    if (!foes.length) return { a: -Math.PI / 2, pw: 30, w: 'basic' };
    const humans = foes.filter(o => !o.isAI);
    let target = (humans.length && R() < 0.4) ? humans[Math.floor(R() * humans.length)] : foes.reduce((b, o) => Math.abs(o.x - t.x) < Math.abs(b.x - t.x) ? o : b, foes[0]);
    let best = { d: 1e9, a: -Math.PI / 4, pw: 60 };
    for (let deg = 8; deg <= 172; deg += 4) { const a = -deg * Math.PI / 180; for (let pw = 22; pw <= 100; pw += 3) { const r = simulate(t, a, pw, S.wind, 6); if (r.out) continue; let d = Math.hypot(r.x - target.x, r.y - (target.y - 10)) + (r.hit === t ? 500 : 0) + (Math.hypot(r.x - t.x, r.y - t.y) < 70 ? 300 : 0); for (const mt of mates) if (Math.hypot(r.x - mt.x, r.y - (mt.y - 10)) < 70) d += 400; if (d < best.d) best = { d, a, pw }; } }
    const noise = [[11, 6], [5, 2.6], [2, 1]][diff === undefined ? 1 : diff];
    let wpn = 'basic'; const ammo = t.ammo || {}; const opts2 = Object.keys(ammo).filter(k => ammo[k] > 0 && !WSTAT[k].dirt); const sup = opts2.filter(k => SUPER.includes(k));
    if (sup.length && R() < 0.5) wpn = sup[0]; else if (opts2.length && R() < 0.35) wpn = opts2[Math.floor(R() * opts2.length)];
    if (wpn !== 'basic') ammo[wpn]--;
    return { a: best.a + rand(-noise[1], noise[1]) * Math.PI / 180, pw: clamp(best.pw + rand(-noise[0], noise[0]), 10, 100), w: wpn };
  };
  S.newWind = function () { S.wind = clamp((S.wind || 0) / WINDMAX * 0.4 + rand(-0.8, 0.8), -1, 1) * WINDMAX; return S.wind; };
  S.heal = HEAL;
  return S;
}

const API = { GRAV, VMAX, WINDMAX, WSTAT, SUPER, MAPKEYS, HEAL, rng, genWorld, isSolidW, carveW, dirtW, pickSpawns, makeSim, surfaceYW };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TankEngine = API;
})(typeof window !== 'undefined' ? window : this);
