// 공부하는 탱크 — 최종 점수와 실시간 티어 (수업 1시간 안에 티어가 움직이도록)
// 최종 점수 = 승률 점수 + 플레이 점수
//   승률 점수 = 승률 × 배점. 배점은 경기 수의 자릿수에 따라: 1~9판 1,000 / 10~99판 2,000 / 100~999판 4,000 (자리가 올라갈 때마다 2배)
//   플레이 점수 = 경기 수 × 5
//   승률: 팀전 승리 1, 무승부 0.5, 패배 0 / 개인전은 이긴 비율 (1등 1, 꼴찌 0)
// 티어는 1판 이상 한 사람들을 최종 점수로 줄 세워 내 위치 비율로 매번 다시 정한다
const TIERS = [ // [이름, 짧은 표시, 색, 이 티어가 시작되는 아래에서부터 비율]
  ['아이언', 'I', '#8a8f98', 0.00],
  ['브론즈', 'B', '#c0773f', 0.10],
  ['실버', 'S', '#b9c6d3', 0.30],
  ['골드', 'G', '#f2c94c', 0.55],
  ['플래티넘', 'P', '#3fd1b5', 0.75],
  ['다이아몬드', 'D', '#6fa8ff', 0.88],
  ['마스터', 'M', '#c77dff', 0.96],
];
const DIVS = ['IV', 'III', 'II', 'I'];
const PLAY_PT = 5, BASE = 1000;
const weightFor = g => BASE * Math.pow(2, Math.max(0, String(Math.max(1, g | 0)).length - 1)); // 1~9:1000, 10~99:2000, 100~:4000
function scoreOf(v) {
  const g = (v && v.g) | 0; if (!g) return { score: 0, winPt: 0, playPt: 0, wr: 0, weight: BASE, g: 0 };
  const beat = v.b !== undefined ? v.b : (v.w | 0); const wr = beat / g; const weight = weightFor(g);
  const winPt = Math.round(wr * weight), playPt = g * PLAY_PT;
  return { score: winPt + playPt, winPt, playPt, wr: Math.round(wr * 100), weight, g };
}

// ── 플레이 점수 (수업용 반 순위표) — 레이팅과 달리 격차가 크지 않게, 매 경기 점수를 더해 감
//   한 경기 = 참여 10 + 승리 점수(최대 20) + 피해량(10당 1, 최대 30) + 처치(1명 5, 최대 15) + 전투 골드(30G당 1, 최대 15)  → 한 경기 최대 90
//   플레이 점수 = 경기 점수 합 + 승률 보너스(승률 × 30)
const PS = { join: 10, win: 20, dmgPer: 10, dmgMax: 30, kill: 5, killMax: 15, goldPer: 30, goldMax: 15, wrBonus: 30 };
function matchPlayScore(beat, dmg, kills, gold) {
  const parts = { 참여: PS.join, 승리: Math.round(PS.win * beat), 피해: Math.min(PS.dmgMax, Math.round((dmg || 0) / PS.dmgPer)), 처치: Math.min(PS.killMax, (kills || 0) * PS.kill), 골드: Math.min(PS.goldMax, Math.round((gold || 0) / PS.goldPer)) };
  return { total: Object.values(parts).reduce((a, b) => a + b, 0), parts };
}
function playScoreOf(v) { if (!v || !v.pg) return 0; return (v.ps || 0) + Math.round(PS.wrBonus * (v.pw || 0) / v.pg); }

function makeRatings(store) {
  let R = {}; let dirty = false; let cache = null;
  const load = async () => { try { const v = await store.kvGet('ratings'); if (v) R = JSON.parse(v); } catch (e) { console.error('ratings load', e.message); } };
  const save = async () => { if (!dirty) return; dirty = false; try { await store.kvSet('ratings', JSON.stringify(R)); } catch (e) { console.error('ratings save', e.message); } };
  const get = (uid, name) => R[uid] || (R[uid] = { n: name || '', g: 0, w: 0, b: 0 });
  const ranked = () => cache || (cache = Object.entries(R).filter(([, v]) => v.g >= 1).map(([uid, v]) => ({ uid: +uid, s: scoreOf(v).score })).sort((a, b) => a.s - b.s));

  function tierOf(uid) {
    const v = R[uid]; const S = scoreOf(v);
    const base = { r: S.score, winPt: S.winPt, playPt: S.playPt, wr: S.wr, weight: S.weight, games: S.g, wins: v ? v.w : 0 };
    if (!v || !v.g) return { name: '첫 판 전', short: '?', color: '#9aa3ad', ...base };
    const list = ranked(); const N = list.length;
    let below = 0, same = 0; for (const o of list) { if (o.s < S.score) below++; else if (o.s === S.score) same++; }
    const p = N <= 1 ? 0.5 : (below + (same - 1) / 2) / (N - 1);   // 0 = 꼴찌, 1 = 1등
    let i = 0; for (let k = 0; k < TIERS.length; k++) if (p >= TIERS[k][3] - 1e-9) i = k;
    const T = TIERS[i], lo = T[3], hi = TIERS[i + 1] ? TIERS[i + 1][3] : 1;
    let div = -1; if (i < TIERS.length - 1) div = Math.min(3, Math.floor((p - lo) / ((hi - lo) / 4)));
    const rank = N - below - (same - 1);
    return { name: T[0] + (div >= 0 ? ' ' + DIVS[div] : ''), short: T[1] + (div >= 0 ? 4 - div : ''), color: T[2], tier: i, div, rank, of: N, top: Math.max(1, Math.round((1 - p) * 100)), ...base };
  }

  // 경기 결과 반영. st: [{uid, name, team, points}] (점수 높은 순), teamMode, teamWins
  function apply(st, teamMode, teamWins, cls) {
    const humans = st.filter(p => p.uid); if (!humans.length) return {};
    const before = {}; for (const p of humans) before[p.uid] = tierOf(p.uid);
    const n = st.length;
    for (const p of humans) {
      let beat;
      if (teamMode) beat = teamWins[0] === teamWins[1] ? 0.5 : (teamWins[p.team] > teamWins[1 - p.team] ? 1 : 0);
      else { const lower = st.filter(o => o.points < p.points).length, same = st.filter(o => o !== p && o.points === p.points).length; beat = n > 1 ? (lower + same / 2) / (n - 1) : 0; }
      const v = get(p.uid, p.name); v.n = p.name; if (v.b === undefined) v.b = v.w | 0; v.g++; v.b += beat; if (beat >= 1) v.w++;
      const m = matchPlayScore(beat, p.dmg, p.kills, p.gold); p.play = m;
      v.ps = (v.ps || 0) + m.total; v.pg = (v.pg || 0) + 1; v.pw = (v.pw || 0) + beat; v.dm = (v.dm || 0) + Math.round(p.dmg || 0); v.k = (v.k || 0) + (p.kills || 0); v.gd = (v.gd || 0) + Math.round(p.gold || 0);
      if (cls) v.cls = cls;
    }
    cache = null; dirty = true; save();
    const out = {}; for (const p of humans) { const a = tierOf(p.uid); out[p.uid] = { before: before[p.uid], after: a, d: a.r - before[p.uid].r, play: p.play, playTotal: playScoreOf(R[p.uid]) }; }
    return out;
  }
  function board(limit) { return ranked().slice().reverse().slice(0, limit || 50).map(o => ({ ...tierOf(o.uid), player: R[o.uid].n })); }
  // 반 순위표: 그 반에서 플레이한 사람을 플레이 점수로 줄 세움
  function classBoard(cls, limit) {
    const all = Object.entries(R).filter(([, v]) => v.cls === cls && v.pg > 0).map(([uid, v]) => ({ uid: +uid, player: v.n, score: playScoreOf(v), games: v.pg, wr: Math.round(100 * (v.pw || 0) / v.pg), dmg: v.dm || 0, kills: v.k || 0, gold: v.gd || 0, sum: v.ps || 0 }))
      .sort((a, b) => b.score - a.score || b.games - a.games);
    let rank = 0, prev = null; all.forEach((o, i) => { if (o.score !== prev) { rank = i + 1; prev = o.score; } o.rank = rank; const t = tierOf(o.uid); o.tier = t.name; o.short = t.short; o.color = t.color; });
    return { list: limit ? all.slice(0, limit) : all, of: all.length, mine: uid => all.find(o => o.uid === uid) || null };
  }
  function reset() { R = {}; cache = null; dirty = true; save(); }
  // 그 반 플레이 점수만 0으로 (티어·승률 레이팅은 그대로)
  function resetClass(cls) { let n = 0; for (const v of Object.values(R)) if (v.cls === cls) { v.ps = 0; v.pg = 0; v.pw = 0; v.dm = 0; v.k = 0; v.gd = 0; n++; } dirty = true; save(); return n; }
  return { load, save, tierOf, apply, board, get, reset, classBoard, resetClass };
}
module.exports = { makeRatings, TIERS, scoreOf, weightFor, PS, matchPlayScore, playScoreOf };
