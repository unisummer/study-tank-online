// 공부하는 탱크 — 서버 대전 진행 (3단계)
// 서버가 차례·바람·발사 결과·라운드 보상을 정하고, 휴대폰은 결과를 받아 보여 준다.
const E = require('./engine');

const TEAMCOL = [['#3fa7ff', '#5cc8ff', '#2f7fe0', '#8fd3ff'], ['#ff5a5f', '#ff8a5c', '#e0434f', '#ff9fb0']];
const COLORS = ['#3fa7ff', '#ff5a5f', '#ffb400', '#b06bff', '#2ecc71', '#ff8fd0', '#ff7f27', '#bfbfbf'];
const AI_AMMO = () => ({ scatter: 1, big: 1, dig: 1, mirv: 1, roller: 1, [E.SUPER[Math.floor(Math.random() * E.SUPER.length)]]: 1 });
const AWAY_TO_AI = 60000;
// 라운드 보상 — 사람이 많은 판일수록 크게. 컴퓨터 탱크는 반만 셈 (컴퓨터로 채워 보상 부풀리기 방지)
const RW = { rankPerBeat: 60, teamWinPerEnemy: 100, teamLosePerEnemy: 30, aliveBonus: 50, aiWeight: 0.5 };
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

class Battle {
  constructor(room, io) {
    this.room = room; this.io = io;   // io: {bc(obj), to(uid,obj), online(uid)}
    this.teamMode = room.mode === 'team';
    const tc = [0, 0];
    this.players = room.slots.map((s, i) => ({
      uid: s.uid || 0, name: s.name, ai: !!s.ai, team: this.teamMode ? s.team : i,
      color: this.teamMode ? TEAMCOL[s.team][tc[s.team]++ % 4] : COLORS[i % 8], points: 0, kills: 0, dmg: 0, away: 0,
    }));
    this.round = 0; this.total = room.rounds; this.teamWins = [0, 0]; this.turnSec = room.turn || 20;
    this.state = 'start'; this.timers = new Set(); this.next = new Set();
    this.later(() => this.startRound(), 1200);
  }
  later(fn, ms) { const t = setTimeout(() => { this.timers.delete(t); if (!this.dead) fn(); }, ms); this.timers.add(t); return t; }
  stop() { this.dead = true; for (const t of this.timers) clearTimeout(t); this.timers.clear(); }
  bc(o) { this.io.bc(o); }
  loadout(uid) { return (this.room.loadouts && this.room.loadouts[uid]) || {}; }

  tankView(t) { return { i: t.i, uid: t.uid, name: t.name, team: t.team, isAI: t.isAI, color: t.color, x: Math.round(t.x), y: Math.round(t.y), hp: t.hp, hpMax: t.hpMax, alive: t.alive, angle: +t.angle.toFixed(3), shield: !!t.shield, rainbow: t.rainbow || 0, chute: !!t.chute, spider: !!t.spider, rot: +(t.rot || 0).toFixed(2), fuelMax: t.fuelMax, dmgMul: t.dmgMul, roundKills: t.roundKills || 0 }; }
  roundInfo() { return { mapArg: this.room.map, round: this.round, total: this.total, seed: this.seed, kind: this.world.kind, teamMode: this.teamMode, teamWins: this.teamWins, tanks: this.tanks.map(t => this.tankView(t)), crates: this.sim.crates.map(c => ({ id: c.id, x: c.x, y: c.y })), turnSec: this.turnSec, data: this.room.data }; }

  startRound() {
    this.round++; this.state = 'start';
    const n = this.players.length;
    this.seed = Math.floor(Math.random() * 1e9);
    this.world = E.genWorld(this.seed, this.room.map, n);
    let spawns = E.pickSpawns(this.world, n, this.world.R);
    if (this.teamMode) {
      const sorted = spawns.slice().sort((a, b) => a.x - b.x); const half = Math.ceil(n / 2);
      let left = sorted.slice(0, n - Math.floor(n / 2)), right = sorted.slice(n - Math.floor(n / 2));
      if (Math.random() < 0.5) [left, right] = [right, left];
      const ia = [0, 0]; spawns = this.players.map(p => (p.team === 0 ? left : right)[ia[p.team]++] || sorted[0]);
      void half;
    }
    this.tanks = this.players.map((p, i) => {
      const lo = p.ai ? {} : this.loadout(p.uid); const up = lo.up || {};
      const armor = clamp(up.armor | 0, 0, 10), barrel = clamp(up.barrel | 0, 0, 10), engine = clamp(up.engine | 0, 0, 10);
      const hpMax = Math.round(100 * (1 + 0.03 * armor));
      return { i, uid: p.uid, name: p.name, team: p.team, isAI: p.ai, color: p.color, x: spawns[i].x, y: spawns[i].y, vx: 0, vy: 0, air: false, peak: 0,
        hp: hpMax, hpMax, alive: true, angle: spawns[i].x < this.world.WW / 2 ? -Math.PI / 4 : -Math.PI * 3 / 4, dmgMul: 1 + 0.03 * barrel, fuelMax: 100 * (1 + 0.03 * engine),
        shield: !!lo.startShield && !p.ai, rainbow: 0, chute: false, spider: false, rot: 0, roundKills: 0, ammo: p.ai ? AI_AMMO() : null };
    });
    this.sim = E.makeSim(this.world, this.tanks, { teamMode: this.teamMode });
    this.roundGold = {}; this.ops = []; this.cycle = 1;
    this.sim.dropCrate();
    this.turnStart = Math.floor(Math.random() * n); this.turn = this.turnStart - 1;
    this.bc({ t: 'b_round', info: this.roundInfo() });
    this.later(() => this.nextTurn(true), 2500);
  }
  addGold(goldByI) { for (const i in goldByI) { const g = this.roundGold[i] || (this.roundGold[i] = {}); for (const l in goldByI[i]) g[l] = (g[l] || 0) + goldByI[i][l]; } }
  weight(list) { return list.reduce((a, o) => a + (this.players[o.i].ai && !this.players[o.i].uid ? RW.aiWeight : 1), 0); }
  fmt(x) { return Number.isInteger(x) ? String(x) : x.toFixed(1); }
  aliveTeams() { return [...new Set(this.tanks.filter(t => t.alive).map(t => t.team))]; }

  nextTurn(first) {
    if (this.dead) return;
    if (this.aliveTeams().length <= 1) return this.endRound();
    const n = this.tanks.length; let idx = this.turn; const extra = {};
    for (let k = 0; k < n; k++) {
      idx = (idx + 1) % n;
      if (idx === this.turnStart && !first) {
        this.cycle++;
        const g = {}; for (const t of this.tanks) if (t.alive && !t.isAI) g[t.i] = { 생존: 10 }; this.addGold(g); extra.survive = 10;
        if (Math.random() < 0.45) { const c = this.sim.dropCrate(); if (c) extra.crate = { id: c.id, x: c.x, y: c.y }; }
        if (this.cycle > 12) return this.endRound('time');
      }
      first = false; if (this.tanks[idx].alive) break;
    }
    this.turn = idx; const t = this.tanks[idx];
    this.flags = { double: false, warp: false, repairUsed: false };
    this.sim.newWind(); this.state = 'aim';
    const p = this.players[idx];
    const away = !t.isAI && !this.io.online(t.uid);
    const ms = t.isAI ? 0 : (away ? 4000 : this.turnSec * 1000);
    this.deadline = Date.now() + ms;
    this.bc({ t: 'b_turn', i: idx, wind: +this.sim.wind.toFixed(2), ms, cycle: this.cycle, extra });
    if (t.isAI) this.later(() => this.aiAct(t), 900);
    else { const myRound = this.round, myTurn = this.turnId = (this.turnId || 0) + 1; this.later(() => { if (this.state === 'aim' && this.turn === idx && this.round === myRound && this.turnId === myTurn) { this.bc({ t: 'b_sys', text: `${t.name} 시간 끝!` }); this.nextTurn(); } }, ms + 300); }
    void p;
  }
  aiAct(t) {
    if (this.state !== 'aim' || this.tanks[this.turn] !== t) return;
    const plan = this.sim.aiPlan(t, 1);
    this.bc({ t: 'b_aim', i: t.i, a: +plan.a.toFixed(3), pw: Math.round(plan.pw), w: plan.w });
    this.later(() => this.doShot(t, plan.a, plan.pw, plan.w, {}), 800);
  }
  doShot(t, ang, pow, w, flags) {
    if (this.state !== 'aim') return;
    this.state = 'resolve'; this.turnId = (this.turnId || 0) + 1;
    const res = this.sim.resolveShot(t, ang, pow, w, flags);
    for (const e of res.ev) if (e.e === 'boom') this.ops.push([e.dirt ? 1 : 0, e.x, e.y, e.r]);
    this.addGold(res.gold);
    for (const tk of this.tanks) { const p = this.players[tk.i]; p.kills = (p.kills || 0); }
    this.bc({ t: 'b_shot', i: t.i, a: +ang.toFixed(4), pw: +pow.toFixed(2), w, warp: !!flags.warp, dbl: !!flags.double, res, final: this.tanks.map(x => this.tankView(x)) });
    this.later(() => this.nextTurn(), Math.round(res.dur * 1000) + 900);
  }

  /* ---- 휴대폰에서 온 것 ---- */
  curOf(uid) { const t = this.tanks && this.tanks[this.turn]; return t && this.state === 'aim' && !t.isAI && t.uid === uid ? t : null; }
  onPos(uid, m) {
    const t = this.curOf(uid); if (!t) return;
    t.x = clamp(+m.x || t.x, 12, this.world.WW - 12); t.y = clamp(+m.y || t.y, 0, this.world.WH + 40); t.angle = +m.a || t.angle; t.rot = +m.r || 0;
    this.bc({ t: 'b_pos', i: t.i, x: Math.round(t.x), y: Math.round(t.y), a: +t.angle.toFixed(3), r: +(t.rot || 0).toFixed(2), sp: m.sp ? 1 : 0 });
    const ev = this.sim.touchCrates(t); if (ev) { for (const e of ev) if (e.e === 'gold') this.addGold({ [e.i]: { [e.l]: e.a } }); this.bc({ t: 'b_ev', ev }); }
  }
  onItem(uid, m) {
    const t = this.curOf(uid); if (!t) return; const k = String(m.k || ''); let ok = true;
    if (E.HEAL[k]) { if (this.flags.repairUsed || t.hp >= t.hpMax) ok = false; else { t.hp = Math.min(t.hpMax, t.hp + E.HEAL[k]); this.flags.repairUsed = true; } }
    else if (k === 'shield') { if (t.shield || t.rainbow > 0) ok = false; else t.shield = true; }
    else if (k === 'rainbow') { if (t.shield || t.rainbow > 0) ok = false; else t.rainbow = 3; }
    else if (k === 'chute') t.chute = true;
    else if (k === 'spider') t.spider = true;
    else if (k === 'double') this.flags.double = true;
    else if (k === 'warp') this.flags.warp = true;
    else if (k === 'scope' || k === 'tele') { /* 휴대폰에서만 효과 (순간이동은 위치로 전달) */ }
    else ok = false;
    this.bc({ t: 'b_item', i: t.i, k, ok, tank: this.tankView(t) });
  }
  onFire(uid, m) {
    const t = this.curOf(uid); if (!t) return;
    if (m.x !== undefined) { t.x = clamp(+m.x, 12, this.world.WW - 12); t.y = clamp(+m.y, 0, this.world.WH + 40); }
    const w = E.WSTAT[m.w] && !['mirvc', 'deathc', 'airb', 'napf', 'tri2', 'tri3'].includes(m.w) ? m.w : 'basic';
    const ang = +m.a, pow = clamp(+m.pw || 50, 5, 100); if (!isFinite(ang)) return;
    this.doShot(t, ang, pow, w, { double: this.flags.double || !!m.dbl, warp: this.flags.warp || !!m.warp, secondW: m.w2 && E.WSTAT[m.w2] ? m.w2 : 'basic' });
  }
  onFell(uid) { const t = this.curOf(uid); if (!t) return; this.sim.ev = []; this.sim.t = 0; this.sim.gold = {}; this.sim.killTank(t, 'fall'); const ev = this.sim.ev; this.sim.ev = null; this.addGold(this.sim.gold); this.bc({ t: 'b_ev', ev }); this.state = 'resolve'; this.later(() => this.nextTurn(), 1200); }
  onNext(uid) { this.next.add(uid); this.checkNext(); }
  checkNext() { if (this.state !== 'inter') return; const humans = this.players.filter(p => !p.ai && this.io.online(p.uid)); if (humans.every(p => this.next.has(p.uid))) this.goNext(); }
  goNext() { if (this.state !== 'inter') return; this.state = 'start'; this.next.clear(); if (this.round >= this.total) this.matchEnd(); else this.startRound(); }
  onAway(uid) { const p = this.players.find(p => p.uid === uid); if (!p || p.ai) return; p.away = Date.now(); this.later(() => { if (p.away && Date.now() - p.away >= AWAY_TO_AI - 100 && !this.io.online(uid)) this.toAI(p, '연결이 끊긴 지 60초가 지나 컴퓨터가 대신해요'); }, AWAY_TO_AI); this.checkNext(); }
  onBack(uid, send) { const p = this.players.find(p => p.uid === uid); if (p) p.away = 0; send({ t: 'b_sync', info: this.tanks ? this.roundInfo() : null, ops: this.ops || [], turn: this.turn, state: this.state, ms: Math.max(0, (this.deadline || 0) - Date.now()), wind: this.sim ? this.sim.wind : 0, players: this.players.map(p => ({ name: p.name, team: p.team, uid: p.uid, ai: p.ai })) }); }
  toAI(p, why) { p.ai = true; const i = this.players.indexOf(p); if (this.tanks && this.tanks[i]) { this.tanks[i].isAI = true; this.tanks[i].ammo = AI_AMMO(); if (this.state === 'aim' && this.turn === i) this.later(() => this.aiAct(this.tanks[i]), 600); } this.bc({ t: 'b_sys', text: `${p.name}: ${why}` }); this.bc({ t: 'b_ai', i }); this.checkNext(); }

  /* ---- 라운드 · 경기 끝 ---- */
  endRound(why) {
    if (this.state === 'inter' || this.state === 'over') return;
    this.state = 'inter'; this.next.clear();
    const n = this.tanks.length; let winTeam = -1;
    const alive = this.tanks.filter(t => t.alive).sort((a, b) => b.hp - a.hp), dead = this.tanks.filter(t => !t.alive).sort((a, b) => b.deathOrder - a.deathOrder);
    const order = alive.concat(dead); const bonus = {};
    if (this.teamMode) {
      const hpOf = tm => this.tanks.filter(t => t.team === tm && t.alive).reduce((a, t) => a + t.hp, 0);
      winTeam = hpOf(0) === hpOf(1) ? (Math.random() < 0.5 ? 0 : 1) : (hpOf(0) > hpOf(1) ? 0 : 1);
      this.teamWins[winTeam]++;
      for (const t of this.tanks) { t.rank = t.team === winTeam ? 1 : 2; if (t.team === winTeam) this.players[t.i].points += 2; if (!t.isAI) { const en = this.weight(this.tanks.filter(o => o.team !== t.team)); bonus[t.i] = t.team === winTeam ? { [`팀 승리 (상대 ${this.fmt(en)}대)`]: Math.round(RW.teamWinPerEnemy * en) } : { [`팀 패배 위로 (상대 ${this.fmt(en)}대)`]: Math.round(RW.teamLosePerEnemy * en) }; if (t.alive) bonus[t.i]['끝까지 생존'] = RW.aliveBonus; } }
    } else {
      order.forEach((t, k) => { t.rank = k + 1; this.players[t.i].points += n - 1 - k; });
      const maxK = i => Math.max(0, ...this.tanks.filter(t => t.i !== i).map(t => t.roundKills || 0));
      for (const t of this.tanks) { if (t.isAI) continue; const b = {}; const below = this.weight(order.slice(t.rank)); const rr = Math.round(RW.rankPerBeat * below); if (rr > 0) b[`${n}명 중 ${t.rank}등 보상`] = rr;
        if (t.rank === 1 && (t.roundKills || 0) > 0 && t.roundKills >= maxK(t.i)) { const sum = Object.values(this.roundGold[t.i] || {}).reduce((a, b) => a + b, 0); if (sum) b['완벽 보상(처치+생존)'] = sum + (rr || 0); }
        bonus[t.i] = b; }
    }
    this.addGold(bonus);
    for (const t of this.tanks) { const p = this.players[t.i]; p.kills += t.roundKills || 0; p.dmg += t.dmgDealt || 0; }
    this.bc({ t: 'b_round_end', round: this.round, total: this.total, why: why || '', winTeam, teamWins: this.teamWins,
      ranks: this.tanks.map(t => ({ i: t.i, rank: t.rank, alive: t.alive, kills: t.roundKills || 0 })), gold: this.roundGold, points: this.players.map(p => p.points) });
    this.later(() => this.goNext(), 25000);
  }
  matchEnd() {
    this.state = 'over';
    const st = this.players.map((p, i) => ({ i, name: p.name, uid: p.uid, team: p.team, ai: p.ai, points: p.points, kills: p.kills, dmg: p.dmg })).sort((a, b) => b.points - a.points || b.kills - a.kills);
    this.bc({ t: 'b_match_end', standings: st, teamMode: this.teamMode, teamWins: this.teamWins });
    this.room.state = 'wait'; this.room.battle = null; this.room.slots.forEach(s => { if (!s.ai) s.ready = false; });
    this.stop(); this.io.done();
  }
}
module.exports = { Battle };
