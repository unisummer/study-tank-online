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
