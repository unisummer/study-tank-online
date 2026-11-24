// 공부하는 탱크 — 실력 점수(MMR)와 실시간 티어
// - 많이 한다고 오르지 않는다: 이기면 오르고 지면 내려가는 실력 점수(엘로 방식)
// - 티어는 전체 플레이어 중 내 실력 점수 위치(비율)로 매번 새로 정한다 → 다른 사람의 경기로도 바뀔 수 있음
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
const START = 1000, AI_R = 1000, PLACEMENT = 3, K = 40, K_PLACE = 80;

function makeRatings(store) {
  let R = {}; let dirty = false; let cache = null;
  const load = async () => { try { const v = await store.kvGet('ratings'); if (v) R = JSON.parse(v); } catch (e) { console.error('ratings load', e.message); } };
  const save = async () => { if (!dirty) return; dirty = false; try { await store.kvSet('ratings', JSON.stringify(R)); } catch (e) { console.error('ratings save', e.message); } };
  const get = (uid, name) => R[uid] || (R[uid] = { n: name || '', r: START, g: 0, w: 0 });
  const ranked = () => cache || (cache = Object.entries(R).filter(([, v]) => v.g >= PLACEMENT).map(([uid, v]) => ({ uid: +uid, r: v.r })).sort((a, b) => a.r - b.r));

  // 지금 이 사람의 티어 (전체 중 비율로)
  function tierOf(uid) {
    const v = R[uid];
    if (!v || v.g < PLACEMENT) return { name: '배치 중', short: '?', color: '#9aa3ad', place: v ? v.g : 0, need: PLACEMENT, r: v ? Math.round(v.r) : START, games: v ? v.g : 0, wins: v ? v.w : 0 };
    const list = ranked(); const N = list.length;
    let below = 0, same = 0; for (const o of list) { if (o.r < v.r) below++; else if (o.r === v.r) same++; }
    const p = N <= 1 ? 0.5 : (below + (same - 1) / 2) / (N - 1);   // 0 = 꼴찌, 1 = 1등
    let i = 0; for (let k = 0; k < TIERS.length; k++) if (p >= TIERS[k][3] - 1e-9) i = k;
    const T = TIERS[i], lo = T[3], hi = TIERS[i + 1] ? TIERS[i + 1][3] : 1;
    let div = -1; if (i < TIERS.length - 1) div = Math.min(3, Math.floor((p - lo) / ((hi - lo) / 4)));
    const rank = N - below - (same - 1);   // 위에서 몇 등
    return { name: T[0] + (div >= 0 ? ' ' + DIVS[div] : ''), short: T[1] + (div >= 0 ? 4 - div : ''), color: T[2], tier: i, div, r: Math.round(v.r), rank, of: N, top: Math.max(1, Math.round((1 - p) * 100)), games: v.g, wins: v.w };
  }

  // 경기 결과 반영. st: [{uid, name, ai, team, points, kills}] (점수 높은 순), teamMode, teamWins
  function apply(st, teamMode, teamWins) {
    const humans = st.filter(p => p.uid);
    if (!humans.length) return {};
    const rOf = p => p.uid ? get(p.uid, p.name).r : AI_R;
    const before = {}; for (const p of humans) before[p.uid] = tierOf(p.uid);
    const delta = {};
    if (teamMode) {
      const avg = tm => { const m = st.filter(p => p.team === tm); return m.reduce((a, p) => a + rOf(p), 0) / Math.max(1, m.length); };
      const ra = [avg(0), avg(1)]; const s0 = teamWins[0] === teamWins[1] ? 0.5 : teamWins[0] > teamWins[1] ? 1 : 0;
      for (const p of humans) { const me = p.team, op = 1 - me; const E = 1 / (1 + Math.pow(10, (ra[op] - ra[me]) / 400)); const S = me === 0 ? s0 : 1 - s0;
        const k = get(p.uid).g < PLACEMENT ? K_PLACE : K; delta[p.uid] = k * (S - E); }
    } else {
      const n = st.length;
      for (const p of humans) { let d = 0; const k = get(p.uid).g < PLACEMENT ? K_PLACE : K; const ri = rOf(p);
        for (const o of st) { if (o === p) continue; const S = p.points > o.points ? 1 : p.points < o.points ? 0 : 0.5;
          const E = 1 / (1 + Math.pow(10, (rOf(o) - ri) / 400)); const w = o.uid ? 1 : 0.5;   // 컴퓨터 상대는 반만
          d += (k / (n - 1)) * w * (S - E); }
        delta[p.uid] = d; }
    }
    for (const p of humans) { const v = get(p.uid, p.name); v.n = p.name; v.r = Math.max(100, v.r + delta[p.uid]); v.g++;
      const won = teamMode ? (teamWins[p.team] > teamWins[1 - p.team]) : st[0] === p; if (won) v.w++; }
    cache = null; dirty = true; save();
    const out = {}; for (const p of humans) out[p.uid] = { before: before[p.uid], after: tierOf(p.uid), d: Math.round(delta[p.uid]) };
    return out;
  }
  function board(limit) { const list = ranked().slice().reverse().slice(0, limit || 50); return list.map(o => ({ name: R[o.uid].n, ...tierOf(o.uid) })); }
  return { load, save, tierOf, apply, board, get };
}
module.exports = { makeRatings, TIERS, PLACEMENT };
