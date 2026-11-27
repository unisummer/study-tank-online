// 공부하는 탱크 온라인 서버 — 1~3단계: 입장, 멀티 기록 저장, 로비·방·채팅, 반 코드, 서버가 계산하는 온라인 대전
// 뒤집힌 바다 서버와 같은 방식(Render + Neon). 부품 없이 도는 웹소켓(ws-lite)과 저장소(store)를 그대로 씀.
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { attach } = require('./ws-lite');
const { makeStore } = require('./store');
const { Battle } = require('./battle');
const { makeRatings } = require('./rating');

const PORT = +process.env.PORT || 10000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';   // Render 환경 변수에만 넣는다 (채팅·코드에 적지 않음)
const store = makeStore();
const RT = makeRatings(store);
const tierLite = uid => { const t = RT.tierOf(uid); return { name: t.name, short: t.short, color: t.color }; };
let storeOk = false, storeErr = '';

// ---------- 화면 파일 ----------
const PUB = path.join(__dirname, 'public');
const FILES = {};
function loadFile(name) {
  const buf = fs.readFileSync(path.join(PUB, name));
  FILES[name] = { buf, gz: zlib.gzipSync(buf, { level: 9 }), etag: '"' + crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16) + '"' };
}
['index.html', 'admin.html'].forEach(f => { try { loadFile(f); } catch (e) { console.error('화면 파일 없음:', f); } });

// ---------- 입장 (이름 + 내가 정한 비밀번호) ----------
const NAME_RE = /^[\p{L}\p{N}_\- ]{2,12}$/u;
const PW_OK = pw => typeof pw === 'string' && pw.length >= 4 && pw.length <= 30;
const fails = new Map();
const hashPw = (pw, salt) => new Promise((ok, no) => crypto.scrypt(pw, salt, 32, (e, k) => e ? no(e) : ok(k.toString('hex'))));
async function authUid(req) { const h = req.headers.authorization || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : ''; return t ? await store.tokenUid(t) : null; }
const isAdmin = req => !!ADMIN_KEY && req.headers['x-admin-key'] === ADMIN_KEY;

// ---------- 반 코드 (수업 때 선생님이 공개) ----------
let CLASSES = {};   // code -> {name, open, created}
async function loadClasses() { try { const v = await store.kvGet('classes'); if (v) CLASSES = JSON.parse(v); const g = await store.kvGet('grades_public'); if (g) PUBLIC_GRADES = cleanGrades(JSON.parse(g)); } catch (e) { console.error('classes load', e.message); } }
async function saveClasses() { try { await store.kvSet('classes', JSON.stringify(CLASSES)); } catch (e) { console.error('classes save', e.message); } }
const CODE_RE = /^[A-Z0-9]{4,8}$/;
function newCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s; do { s = ''; for (let i = 0; i < 5; i++) s += A[crypto.randomInt(A.length)]; } while (CLASSES[s]); return s; }

// ---------- HTTP ----------
function send(res, code, obj) { const b = Buffer.from(JSON.stringify(obj)); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': b.length }); res.end(b); }
function body(req, limit) {
  return new Promise((ok, no) => { let n = 0; const ch = []; req.on('data', d => { n += d.length; if (n > limit) { no({ code: 413 }); req.destroy(); } else ch.push(d); }); req.on('end', () => { try { ok(JSON.parse(Buffer.concat(ch).toString('utf8') || '{}')); } catch (e) { no({ code: 400 }); } }); req.on('error', no); });
}
async function api(req, res, url) {
  const p = url.pathname;
  if (p === '/api/login' && req.method === 'POST') {
    const b = await body(req, 4096);
    const name = String(b.name || '').normalize('NFC').replace(/\s+/g, ' ').trim(), pw = String(b.pw || ''), fk = name.toLowerCase();
    if (!NAME_RE.test(name)) return send(res, 400, { err: 'name' });
    if (/관리자|선생님|운영자/.test(name)) return send(res, 400, { err: 'reserved' });
    if (!PW_OK(pw)) return send(res, 400, { err: 'pw_format' });
    const f = fails.get(fk); if (f && f.until > Date.now()) return send(res, 429, { err: 'locked', wait: Math.ceil((f.until - Date.now()) / 1000) });
    let u = await store.userByName(name), isNew = false;
    if (!u) {   // 처음이면 그 자리에서 만든다 (접근성 우선)
      const salt = crypto.randomBytes(12).toString('hex'); const id = await store.createUser(name, salt, await hashPw(pw, salt)); u = { id, name }; isNew = true;
    } else {
      const h = await hashPw(pw, u.salt);
      if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(u.hash, 'hex'))) {
        const g = f && f.until > Date.now() - 600000 ? f : { n: 0, until: 0 }; g.n++; if (g.n >= 5) { g.until = Date.now() + 5 * 60000; g.n = 0; } fails.set(fk, g);
        return send(res, 401, { err: 'pw', left: 5 - g.n });
      }
      fails.delete(fk);
    }
    const token = crypto.randomBytes(24).toString('hex'); await store.tokenSet(token, Number(u.id));
    return send(res, 200, { token, name: u.name, id: Number(u.id), isNew });
  }
  if (p === '/api/class' && req.method === 'POST') {   // 반 코드 확인
    const b = await body(req, 1024); const code = String(b.code || '').toUpperCase().trim();
    const c = CLASSES[code]; if (!c || !c.open) return send(res, 404, { err: 'no_class' });
    return send(res, 200, { code, name: c.name });
  }
  // 멀티 기록 (싱글 기록과 완전히 따로). 5단계에서 골드는 서버만 바꾸게 옮길 예정
  if (p === '/api/multi') {
    const uid = await authUid(req); if (!uid) return send(res, 401, { err: 'auth' });
    if (req.method === 'GET') { const d = await store.docGet(uid, 'multi'); return send(res, 200, { data: d ? JSON.parse(d) : null }); }
    if (req.method === 'PUT') { const b = await body(req, 200000); await store.docSet(uid, 'multi', JSON.stringify(b.data || {})); return send(res, 200, { ok: true }); }
  }
  // ---- 선생님(관리자) ----
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 403, { err: 'admin' });
    if (p === '/api/admin/ranking' && req.method === 'GET') return send(res, 200, { board: RT.board(100) });
    if (p === '/api/admin/cboard' && req.method === 'GET') { const code = String(url.searchParams.get('code') || '').toUpperCase(); const b = RT.classBoard(code, 0); return send(res, 200, { code, list: b.list, ps: require('./rating.js').PS }); }
    if (p === '/api/admin/cboard/reset' && req.method === 'POST') { const b = await body(req, 1024); const code = String(b.code || '').toUpperCase().trim(); const n = RT.resetClass(code); sendClassBoards('class:' + code); return send(res, 200, { ok: true, n }); }
    if (p === '/api/admin/ranking/reset' && req.method === 'POST') { RT.reset(); for (const [c2, i2] of conns) S(c2, { t: 'my_tier', tier: RT.tierOf(i2.uid) }); return send(res, 200, { ok: true }); }
    if (p === '/api/admin/classes' && req.method === 'GET') return send(res, 200, { classes: CLASSES, online: onlineList() });
    if (p === '/api/admin/class' && req.method === 'POST') {
      const b = await body(req, 2048); const name = String(b.name || '').slice(0, 20).trim() || '우리 반';
      let code = String(b.code || '').toUpperCase().trim(); if (!CODE_RE.test(code)) code = newCode();
      CLASSES[code] = { name, open: true, created: Date.now() }; await saveClasses(); return send(res, 200, { code, name });
    }
    if (p === '/api/admin/class/open' && req.method === 'POST') {
      const b = await body(req, 1024); const c = CLASSES[String(b.code || '').toUpperCase()]; if (!c) return send(res, 404, { err: 'no_class' });
      c.open = !!b.open; await saveClasses(); return send(res, 200, { ok: true });
    }
    if (p === '/api/admin/grades' && req.method === 'GET') return send(res, 200, { public: PUBLIC_GRADES, classes: Object.fromEntries(Object.entries(CLASSES).map(([k, v]) => [k, v.grades || ALL_GRADES])) });
    if (p === '/api/admin/grades' && req.method === 'POST') {   // 보이는 문제 학년 바꾸기
      const b = await body(req, 1024); const g = cleanGrades(b.grades); let ch = 'public';
      if (b.code && b.code !== 'public') { const c = CLASSES[String(b.code).toUpperCase()]; if (!c) return send(res, 404, { err: 'no_class' }); c.grades = g; ch = 'class:' + String(b.code).toUpperCase(); await saveClasses(); }
      else { PUBLIC_GRADES = g; try { await store.kvSet('grades_public', JSON.stringify(g)); } catch (e) { } }
      for (const r of ROOMS.values()) if (r.channel === ch && r.state === 'wait' && !dataOk(ch, r.data)) { r.data = firstData(ch); pushRoom(r); }
      bcChannel(ch, { t: 'grades', grades: g }); return send(res, 200, { ok: true, grades: g });
    }
    if (p === '/api/admin/chat' && req.method === 'POST') {   // 반 채팅 끄기/켜기
      const b = await body(req, 1024); const ch = String(b.channel || 'public'); CHAT_OFF[ch] = !b.on; bcChannel(ch, { t: 'sys', text: b.on ? '선생님이 채팅을 켰어요.' : '선생님이 채팅을 껐어요.' }); return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { err: 'not_found' });
}
function sendFile(req, res, name) {
  const f = FILES[name]; if (!f) { res.writeHead(404); return res.end(); }
  if (req.headers['if-none-match'] === f.etag) { res.writeHead(304); return res.end(); }
  const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ETag: f.etag, ...(gz ? { 'Content-Encoding': 'gzip' } : {}) });
  res.end(gz ? f.gz : f.buf);
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/healthz') return send(res, 200, { ok: true, store: store.kind, storeOk, storeErr, online: conns.size, rooms: ROOMS.size });
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname === '/' || url.pathname === '/index.html') return sendFile(req, res, 'index.html');
    if (url.pathname === '/admin' || url.pathname === '/admin.html') return sendFile(req, res, 'admin.html');
    res.writeHead(404); res.end();
  } catch (e) { if (e && e.code) return send(res, e.code, { err: 'bad' }); console.error(e); send(res, 500, { err: 'server' }); }
});

// =========================================================
//  실시간: 로비 · 방 · 채팅
// =========================================================
const conns = new Map();   // conn -> {uid, name, channel, room}
const ROOMS = new Map();   // id -> room
const CHAT = {};           // channel -> [{n,text,t}]
const CHAT_OFF = {};       // channel -> true면 꺼짐
let roomSeq = 1;
const BAD = ['바보', '멍청', '시발', '씨발', '병신', '개새', '존나', '꺼져', '닥쳐', '죽어', '븅신', 'ㅅㅂ', 'ㅂㅅ', 'ㅈㄴ', '미친'];
const clean = s => { let o = String(s || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, 120).trim(); for (const w of BAD) o = o.split(w).join('*'.repeat(w.length)); return o; };
const S = (c, o) => c.send(JSON.stringify(o));
// 반 순위표(플레이 점수) — 반 채널의 모든 사람에게 상위 15명 + 내 순위
const CB_TOP = 15;
function classBoardMsg(code, uid) { const b = RT.classBoard(code, 0); const me = b.mine(uid); return { t: 'cboard', list: b.list.slice(0, CB_TOP).map(({ uid: u, ...o }) => ({ ...o, me: u === uid })), of: b.of, me }; }
function sendClassBoards(ch) { if (!ch || !ch.startsWith('class:')) return; const code = ch.slice(6); for (const [c, i] of conns) if (i.channel === ch) S(c, classBoardMsg(code, i.uid)); }
function bcChannel(ch, o, exceptRoom) { const s = JSON.stringify(o); for (const [c, i] of conns) if (i.channel === ch && (!exceptRoom || !i.room)) c.send(s); }
function bcRoom(r, o) { const s = JSON.stringify(o); for (const [c, i] of conns) if (i.room === r.id) c.send(s); }
function onlineList(ch) { const seen = new Map(); for (const i of conns.values()) if (ch === undefined || i.channel === ch) seen.set(i.uid, { name: i.name, room: i.room || null, channel: i.channel }); return [...seen.values()]; }
const MAPS = ['random', 'hills', 'sky', 'canyon', 'towers', 'scorched', 'donuts', 'sphinx', 'logbridge', 'island', 'grave', 'wisland', 'wcave', 'cheese'];
const DATAS = ['phon', 'pos', 'add1', 'add2', 'sub1', 'gugu', 'div1', 'free', 'eng'];
// 문제 범위: 초등·중등·고등 — 선생님 화면에서 전체 공간과 반마다 보이는 학년을 정함
const DATA_GRADE = { add1: 'elem', add2: 'elem', sub1: 'elem', gugu: 'elem', div1: 'elem', phon: 'high', pos: 'high', eng: 'high', free: 'all' };
const ALL_GRADES = ['elem', 'mid', 'high'];
let PUBLIC_GRADES = ALL_GRADES.slice();
const cleanGrades = g => { const v = Array.isArray(g) ? ALL_GRADES.filter(x => g.includes(x)) : []; return v.length ? v : ALL_GRADES.slice(); };
function gradesOf(ch) { if (ch && ch.startsWith('class:')) { const c = CLASSES[ch.slice(6)]; if (c && c.grades) return c.grades; } return PUBLIC_GRADES; }
function dataOk(ch, d) { const g = DATA_GRADE[d]; return DATAS.includes(d) && (g === 'all' || gradesOf(ch).includes(g)); }
function firstData(ch) { return DATAS.find(d => d !== 'free' && dataOk(ch, d)) || 'free'; }
function roomView(r) {
  return { id: r.id, name: r.name, host: r.host, max: r.max, mode: r.mode, map: r.map, rounds: r.rounds, data: r.data, turn: r.turn, state: r.state,
    slots: r.slots.map(s => ({ uid: s.uid || 0, name: s.name, team: s.team, ready: !!s.ready, ai: !!s.ai, away: !!s.away, tier: s.ai && !s.uid ? null : tierLite(s.uid) })) };
}
function lobbyView(ch) { return [...ROOMS.values()].filter(r => r.channel === ch).map(r => ({ id: r.id, name: r.name, n: r.slots.filter(s => !s.ai).length, ai: r.slots.filter(s => s.ai).length, max: r.max, mode: r.mode, map: r.map, data: r.data, state: r.state })); }
function pushLobby(ch) { bcChannel(ch, { t: 'rooms', rooms: lobbyView(ch), online: onlineList(ch) }); }
function pushRoom(r) { bcRoom(r, { t: 'room', room: roomView(r) }); pushLobby(r.channel); }
function teamCount(r, tm) { return r.slots.filter(s => s.team === tm).length; }
function pickTeam(r) { if (r.mode !== 'team') return 0; return teamCount(r, 0) <= teamCount(r, 1) ? 0 : 1; }
function leaveRoom(info, quiet) {
  const r = ROOMS.get(info.room); info.room = null; if (!r) return;
  const i = r.slots.findIndex(s => s.uid === info.uid); if (i >= 0) r.slots.splice(i, 1);
  const humans = r.slots.filter(s => !s.ai);
  if (!humans.length) { if (r.battle) r.battle.stop(); ROOMS.delete(r.id); pushLobby(r.channel); return; }
  if (r.battle) { const p = r.battle.players.find(p => p.uid === info.uid && !p.ai); if (p) r.battle.toAI(p, '방을 나가서 컴퓨터가 대신해요'); }
  if (r.host === info.uid) { r.host = humans[0].uid; if (!quiet) bcRoom(r, { t: 'sys', text: `${humans[0].name} 님이 새 방장이 됐어요.` }); }
  pushRoom(r);
}
function addChat(ch, o) { const L = CHAT[ch] || (CHAT[ch] = []); L.push(o); if (L.length > 50) L.shift(); }
let lastChat = new Map();

function onMsg(c, info, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  const r = info.room ? ROOMS.get(info.room) : null;
  switch (m.t) {
    case 'chat': {
      if (CHAT_OFF[info.channel]) return S(c, { t: 'sys', text: '지금은 선생님이 채팅을 꺼 두었어요.' });
      const now = Date.now(); if (now - (lastChat.get(info.uid) || 0) < 1000) return; lastChat.set(info.uid, now);
      const text = clean(m.text); if (!text) return;
      const o = { t: 'chat', n: info.name, text, at: now, scope: r && m.scope === 'room' ? 'room' : 'lobby' };
      if (o.scope === 'room') bcRoom(r, o); else { addChat(info.channel, o); bcChannel(info.channel, o); }
      return;
    }
    case 'create': {
      if (r) leaveRoom(info, true);
      const id = roomSeq++;
      const nr = { id, channel: info.channel, host: info.uid, state: 'wait', created: Date.now(),
        name: clean(m.name).slice(0, 20) || `${info.name}의 방`, max: Math.min(8, Math.max(2, +m.max || 4)), mode: m.mode === 'team' ? 'team' : 'solo',
        map: MAPS.includes(m.map) ? m.map : 'random', rounds: [1, 3, 5].includes(+m.rounds) ? +m.rounds : 3, data: dataOk(info.channel, m.data) ? m.data : firstData(info.channel),
        turn: [15, 20, 30].includes(+m.turn) ? +m.turn : 20, slots: [] };
      if (nr.mode === 'team' && nr.max % 2) nr.max++;
      nr.slots.push({ uid: info.uid, name: info.name, team: 0, ready: false });
      ROOMS.set(id, nr); info.room = id; pushRoom(nr); return;
    }
    case 'join': {
      const t = ROOMS.get(+m.id); if (!t || t.channel !== info.channel) return S(c, { t: 'err', text: '방이 없어요.' });
      if (t.state !== 'wait') return S(c, { t: 'err', text: '이미 시작한 방이에요.' });
      if (t.slots.some(s => s.uid === info.uid)) { info.room = t.id; return pushRoom(t); }
      if (r) leaveRoom(info, true);
      if (t.slots.length >= t.max) { const ai = t.slots.findIndex(s => s.ai); if (ai < 0) return S(c, { t: 'err', text: '방이 꽉 찼어요.' }); t.slots.splice(ai, 1); }   // 컴퓨터 자리는 사람에게 양보
      if (t.mode === 'team' && teamCount(t, pickTeam(t)) >= t.max / 2) { /* 양쪽이 다 찼으면 위에서 걸러짐 */ }
      t.slots.push({ uid: info.uid, name: info.name, team: pickTeam(t), ready: false }); info.room = t.id; pushRoom(t); bcRoom(t, { t: 'sys', text: `${info.name} 님이 들어왔어요.` }); return;
    }
    case 'leave': if (r) { leaveRoom(info); S(c, { t: 'left' }); S(c, { t: 'rooms', rooms: lobbyView(info.channel), online: onlineList(info.channel) }); } return;
    case 'ready': if (r && r.state === 'wait') { const s = r.slots.find(s => s.uid === info.uid); if (s) { s.ready = !!m.v; pushRoom(r); } } return;
    case 'team': if (r && r.state === 'wait' && r.mode === 'team') { const s = r.slots.find(s => s.uid === info.uid); const tm = m.team ? 1 : 0; if (s && s.team !== tm && teamCount(r, tm) < r.max / 2) { s.team = tm; s.ready = false; pushRoom(r); } } return;
    case 'set': {   // 방장만 설정 변경
      if (!r || r.host !== info.uid || r.state !== 'wait') return;
      if (m.map && MAPS.includes(m.map)) r.map = m.map;
      if (m.data && dataOk(r.channel, m.data)) r.data = m.data;
      if ([1, 3, 5].includes(+m.rounds)) r.rounds = +m.rounds;
      if ([15, 20, 30].includes(+m.turn)) r.turn = +m.turn;
      if (m.mode === 'solo' || m.mode === 'team') { r.mode = m.mode; if (r.mode === 'team') { if (r.max % 2) r.max++; r.slots.forEach((s, i) => s.team = i % 2); } else r.slots.forEach(s => s.team = 0); }
      if (+m.max >= 2 && +m.max <= 8) { let mx = +m.max; if (r.mode === 'team' && mx % 2) mx++; if (mx >= r.slots.filter(s => !s.ai).length) { r.max = mx; while (r.slots.length > r.max) { const ai = r.slots.findIndex(s => s.ai); if (ai < 0) break; r.slots.splice(ai, 1); } } }
      r.slots.forEach(s => { if (!s.ai) s.ready = s.uid === r.host ? s.ready : false; });
      pushRoom(r); return;
    }
    case 'fill_ai': {   // 빈자리를 컴퓨터로 (팀전이면 모자란 팀부터)
      if (!r || r.host !== info.uid || r.state !== 'wait') return;
      let k = 1; while (r.slots.length < r.max) { const tm = pickTeam(r); r.slots.push({ uid: 0, name: '컴퓨터 ' + (k++), team: tm, ai: true, ready: true }); }
      pushRoom(r); return;
    }
    case 'clear_ai': if (r && r.host === info.uid && r.state === 'wait') { r.slots = r.slots.filter(s => !s.ai); pushRoom(r); } return;
    case 'host': if (r && r.host === info.uid && r.state === 'wait') { const s = r.slots.find(s => s.uid === +m.uid && !s.ai && s.uid !== info.uid); if (s) { r.host = s.uid; s.ready = false; const me2 = r.slots.find(x => x.uid === info.uid); if (me2) me2.ready = false; pushRoom(r); bcRoom(r, { t: 'sys', text: `${info.name} 님이 ${s.name} 님에게 방장을 넘겼어요.` }); } } return;
    case 'kick': if (r && r.host === info.uid && r.state === 'wait') { const s = r.slots.find(s => s.uid === +m.uid && s.uid !== info.uid); if (s) { for (const [cc, ii] of conns) if (ii.uid === s.uid && ii.room === r.id) { ii.room = null; S(cc, { t: 'left', why: '방장이 내보냈어요.' }); } r.slots = r.slots.filter(x => x !== s); pushRoom(r); } } return;
    case 'start': {
      if (!r || r.host !== info.uid || r.state !== 'wait') return;
      const humans = r.slots.filter(s => !s.ai);
      if (r.slots.length < 2) return S(c, { t: 'err', text: '2명 이상이어야 시작할 수 있어요. (컴퓨터로 채우기)' });
      if (humans.some(s => s.uid !== r.host && !s.ready)) return S(c, { t: 'err', text: '모두 준비해야 시작할 수 있어요.' });
      if (r.mode === 'team' && (teamCount(r, 0) === 0 || teamCount(r, 1) === 0)) return S(c, { t: 'err', text: '두 팀 모두 한 명 이상 있어야 해요.' });
      r.state = 'playing'; r.seed = crypto.randomInt(1e9);
      pushRoom(r);
      bcRoom(r, { t: 'start', room: roomView(r) });
      r.battle = new Battle(r, {
        bc: o => bcRoom(r, o),
        tier: uid => tierLite(uid),
        rate: (st, tm, tw) => { const cls = r.channel && r.channel.startsWith('class:') ? r.channel.slice(6) : ''; const out = RT.apply(st, tm, tw, cls); if (cls) setTimeout(() => sendClassBoards(r.channel), 50); for (const c2 of conns.keys()) { const i2 = conns.get(c2); if (out[i2.uid]) S(c2, { t: 'my_tier', tier: RT.tierOf(i2.uid) }); } return out; },
        online: uid => { for (const i of conns.values()) if (i.uid === uid && i.room === r.id) return true; return false; },
        done: () => { r.slots = r.slots.filter(s => s.ai || [...conns.values()].some(i => i.uid === s.uid && i.room === r.id)); r.slots.forEach(s => s.away = false); if (!r.slots.some(s => !s.ai)) { ROOMS.delete(r.id); pushLobby(r.channel); return; } if (!r.slots.some(s => s.uid === r.host)) r.host = r.slots.find(s => !s.ai).uid; r.slots.forEach(s => { if (!s.ai) s.ready = false; }); pushRoom(r); bcRoom(r, { t: 'sys', text: '경기가 끝나 준비가 모두 풀렸어요. 상점·문제 풀기를 마치고 다시 「준비」를 누르면 방장이 시작해요.' }); },
      });
      return;
    }
    case 'loadout': if (r) { r.loadouts = r.loadouts || {}; const up = m.up || {}; r.loadouts[info.uid] = { up: { armor: +up.armor | 0, barrel: +up.barrel | 0, engine: +up.engine | 0 }, startShield: !!m.startShield, skin: ['tank','unicorn','u_sky','u_peach','u_lav','u_candy','u_snow','u_night','u_fire','u_lemon'].includes(m.skin) ? m.skin : 'tank' }; } return;
    case 'b_pos': if (r && r.battle) r.battle.onPos(info.uid, m); return;
    case 'b_item': if (r && r.battle) r.battle.onItem(info.uid, m); return;
    case 'b_fire': if (r && r.battle) r.battle.onFire(info.uid, m); return;
    case 'b_skip': if (r && r.battle) r.battle.onSkip(info.uid); return;
    case 'b_fell': if (r && r.battle) r.battle.onFell(info.uid); return;
    case 'b_next': if (r && r.battle) r.battle.onNext(info.uid); return;
    case 'b_sync': if (r && r.battle) r.battle.onBack(info.uid, o => S(c, o)); return;
    case 'rank': S(c, { t: 'rank', me: RT.tierOf(info.uid), board: RT.board(30) }); return;
    case 'cboard': if (info.channel && info.channel.startsWith('class:')) S(c, classBoardMsg(info.channel.slice(6), info.uid)); return;
    case 'ping': return S(c, { t: 'pong' });
  }
}

setInterval(() => { for (const c of conns.keys()) { if (!c.alive) { c.close(); continue; } c.alive = false; c.ping(); } }, 30000);
// 끊긴 사람: 대기 중인 방에서는 60초 뒤에 자리를 비움 (다시 들어오면 그대로)
const awayTimers = new Map();
attach(server, '/ws', async (c, url) => {
  const uid = await store.tokenUid(url.searchParams.get('token') || '').catch(() => null);
  if (!uid) { S(c, { t: 'auth_fail' }); c.close(); return; }
  const u = await store.userById(uid);
  let channel = 'public'; const code = String(url.searchParams.get('class') || '').toUpperCase();
  if (code) { const cl = CLASSES[code]; if (!cl || !cl.open) { S(c, { t: 'class_fail' }); c.close(); return; } channel = 'class:' + code; }
  // 같은 사람이 다른 창으로 다시 들어오면 앞의 연결을 닫는다
  for (const [oc, oi] of conns) if (oi.uid === uid) { S(oc, { t: 'dup' }); conns.delete(oc); oc.close(); }
  const info = { uid: Number(uid), name: u ? u.name : '?', channel, room: null };
  // 끊겼다 돌아온 사람은 원래 방으로
  if (awayTimers.has(info.uid)) { clearTimeout(awayTimers.get(info.uid).t); const rid = awayTimers.get(info.uid).room; awayTimers.delete(info.uid); const rr = ROOMS.get(rid); if (rr && rr.slots.some(s => s.uid === info.uid)) { info.room = rid; rr.slots.forEach(s => { if (s.uid === info.uid) s.away = false; }); } }
  conns.set(c, info);
  c.onmessage = raw => onMsg(c, info, raw);
  c.onclose = () => {
    if (conns.get(c) !== info) return; conns.delete(c);
    const r = info.room ? ROOMS.get(info.room) : null;
    if (r) { r.slots.forEach(s => { if (s.uid === info.uid) s.away = true; }); pushRoom(r);
      if (r.battle) r.battle.onAway(info.uid);
      awayTimers.set(info.uid, { room: r.id, t: setTimeout(() => { awayTimers.delete(info.uid); if (r.battle) { const any = [...conns.values()].some(i => i.room === r.id); if (!any) { r.battle.stop(); ROOMS.delete(r.id); pushLobby(r.channel); } return; } leaveRoom(info); }, 60000) }); }
    pushLobby(channel);
  };
  if (code) setTimeout(() => S(c, classBoardMsg(code, info.uid)), 100);
  S(c, { t: 'hello', grades: gradesOf(channel), you: { id: info.uid, name: info.name, tier: RT.tierOf(info.uid) }, channel, className: code ? CLASSES[code].name : '', rooms: lobbyView(channel), online: onlineList(channel), chat: (CHAT[channel] || []).slice(-30), chatOff: !!CHAT_OFF[channel] });
  if (info.room) { const rr = ROOMS.get(info.room); pushRoom(rr); if (rr.battle) rr.battle.onBack(info.uid, o => S(c, o)); } else pushLobby(channel);
});

(async () => {
  try { await store.init(); storeOk = true; await RT.load(); } catch (e) { storeErr = String(e.message || e); console.error('저장소 연결 실패:', storeErr); }
  await loadClasses();
  server.listen(PORT, () => console.log(`공부하는 탱크 서버: ${PORT}번 포트, 저장소=${store.kind}${storeOk ? '' : ' (연결 실패: ' + storeErr + ')'}`));
})();
process.on('SIGTERM', () => { if (store.flush) store.flush(); process.exit(0); });
