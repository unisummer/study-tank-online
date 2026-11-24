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
  }
  void cl; void valleys;
}
