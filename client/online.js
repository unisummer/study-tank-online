/* =========================================================
   공부하는 탱크 — 온라인 (서버에서 열었을 때만 보임)
   1·2단계: 입장 · 멀티 기록(싱글과 따로) · 로비 · 방 · 채팅 · 반 코드
   ========================================================= */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const ON={token:null,name:null,ws:null,channel:'public',className:'',rooms:[],online:[],room:null,you:null,saveT:0,retry:0,classCode:''};
window.ONLINE=ON;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MAPNAME={random:'랜덤',hills:'언덕 평원',sky:'층층 하늘섬',canyon:'절벽 계곡',towers:'탑과 다리',scorched:'스코치드 협곡'};
const DATANAME={phon:'음운의 변동',add1:'덧셈 (한 자리)',add2:'덧셈 (두 자리)',sub1:'뺄셈',gugu:'구구단',free:'자유 문제'};
const QUICK=['안녕!','잘했어!','한 판 더!','문제 풀고 올게','준비됐어?','좋은 게임!'];

/* ---------- 화면 ---------- */
const css=`
.on-col{display:grid;grid-template-columns:1.6fr 1fr;gap:14px}
@media (max-width:760px){.on-col{grid-template-columns:1fr}}
.on-room{background:#22365a;border-radius:14px;padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.on-room b{font-size:17px}.on-room .sub{font-size:13px}
.on-chat{height:220px;overflow:auto;background:#0f1b2d;border-radius:12px;padding:8px 10px;font-size:14px;line-height:1.5;touch-action:pan-y}
.on-chat .sys{color:#9cc3ff}.on-chat b{color:#ffd43b}
.on-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.on-slot{background:#22365a;border-radius:12px;padding:10px;min-height:58px}
.on-slot.empty{background:transparent;border:2px dashed #2d4670;color:#7f97bd}
.on-slot.ready{outline:3px solid #22a559}
.on-slot.t0{border-left:6px solid #3fa7ff}.on-slot.t1{border-left:6px solid #ff5a5f}
.on-tag{font-size:12px;border-radius:8px;padding:1px 6px;background:rgba(255,255,255,.12);margin-left:4px}
.on-badge{display:inline-block;background:#2b6de8;border-radius:8px;padding:2px 8px;font-weight:800;font-size:13px}
#onChoose{margin-top:14px}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
const html=`
<div id="onChoose" class="card hidden">
  <h3 style="margin-top:0">🌐 온라인으로 함께 하기</h3>
  <div class="sub">친구들과 방을 만들어 대전해요. 온라인 골드·장비는 혼자 하기와 따로예요.</div>
  <label class="f">이름</label><input class="inp" id="onName" maxlength="12" autocomplete="off">
  <label class="f">내 비밀번호 (처음이면 지금 정하면 돼요)</label><input class="inp" id="onPw" type="password" maxlength="30" autocomplete="off">
  <label class="f">반 코드 (수업 시간에만 · 선생님이 알려 준 코드)</label><input class="inp" id="onClass" maxlength="8" placeholder="없으면 비워 두세요" autocomplete="off" style="text-transform:uppercase">
  <div class="row" style="margin-top:12px"><button class="btn big" id="onLogin" style="flex:1">온라인 입장</button></div>
  <div class="sub" id="onMsg" style="margin-top:8px;min-height:20px"></div>
</div>
<div id="sOnLobby" class="screen hidden"><div class="wrap">
  <div class="row" style="justify-content:space-between">
    <div><h1 style="font-size:28px">공부하는 탱크 <span class="on-badge">온라인</span></h1><div class="sub" id="olWho"></div></div>
    <div style="text-align:right"><div class="goldtag" style="font-size:22px" id="olGold">0G</div><div class="sub" id="olRank"></div></div>
  </div>
  <div class="row" style="margin-top:10px">
    <button class="btn big green" id="olCreate">방 만들기</button>
    <button class="btn orange" id="olQuiz">📝 문제 풀고 골드</button>
    <button class="btn" id="olShop">🛒 상점</button><button class="btn" id="olUp">🔧 강화</button><button class="btn" id="olMake">✏️ 문제 만들기</button>
    <button class="btn ghost" id="olOut">나가기</button>
  </div>
  <div class="on-col" style="margin-top:14px">
    <div><h3>방 목록</h3><div id="olRooms" style="display:flex;flex-direction:column;gap:8px"></div></div>
    <div><h3>채팅 · 접속 <span id="olCount"></span></h3><div class="on-chat" id="olChat"></div>
      <div class="chips" id="olQuick" style="margin-top:6px"></div>
      <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="inp" id="olText" maxlength="120" placeholder="채팅 (고운 말!)"><button class="btn" id="olSend">보내기</button></div>
      <div class="sub" id="olUsers" style="margin-top:8px"></div></div>
  </div>
</div></div>
<div id="sOnRoom" class="screen hidden"><div class="wrap">
  <div class="row" style="justify-content:space-between"><h2 id="orTitle">방</h2><button class="btn ghost" id="orLeave">방 나가기</button></div>
  <div class="card">
    <div class="sub" id="orInfo"></div>
    <div id="orHostSet" class="hidden" style="margin-top:8px">
      <div class="row" style="gap:16px;align-items:flex-start">
        <div><div class="sub">대결 방식</div><div class="chips" id="orMode"></div></div>
        <div><div class="sub">인원</div><div class="chips" id="orMax"></div></div>
        <div><div class="sub">라운드</div><div class="chips" id="orRounds"></div></div>
        <div><div class="sub">턴 시간</div><div class="chips" id="orTurn"></div></div>
      </div>
      <div class="sub" style="margin-top:8px">맵</div><div class="chips" id="orMap"></div>
      <div class="sub" style="margin-top:8px">문제 데이터</div><div class="chips" id="orData"></div>
    </div>
  </div>
  <h3>자리</h3><div class="on-slots" id="orSlots"></div>
  <div class="row" style="margin-top:12px">
    <button class="btn green big" id="orReady">준비</button>
    <button class="btn" id="orTeam">팀 바꾸기</button>
    <button class="btn" id="orFill">빈자리 컴퓨터로 채우기</button>
    <button class="btn ghost" id="orClear">컴퓨터 빼기</button>
    <button class="btn orange big" id="orStart">시작!</button>
    <button class="btn orange" id="orSupply">📝 보급 받기 (3문제)</button>
  </div>
  <div class="sub" id="orMsg" style="margin-top:8px;min-height:20px"></div>
  <h3>방 채팅</h3><div class="on-chat" id="orChat" style="height:160px"></div>
  <div class="chips" id="orQuick" style="margin-top:6px"></div>
  <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="inp" id="orText" maxlength="120" placeholder="방 채팅"><button class="btn" id="orSend">보내기</button></div>
</div></div>`;
document.body.insertAdjacentHTML('beforeend',html);
$('#sLogin .card').after($('#onChoose'));

/* ---------- 서버에서 열렸는지 확인 ---------- */
fetch('/healthz',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.ok){$('#onChoose').classList.remove('hidden');const last=localStorageGet('gt_on_last');if(last)$('#onName').value=last}}).catch(()=>{});
function localStorageGet(k){try{return localStorage.getItem(k)}catch(e){return null}}
function localStorageSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}

/* ---------- 입장 ---------- */
const ERR={name:'이름은 2~12글자(한글·영어·숫자)로 써 주세요.',reserved:'그 이름은 쓸 수 없어요.',pw_format:'비밀번호는 4글자 이상으로 정해 주세요.',pw:'비밀번호가 달라요.',locked:'여러 번 틀려서 잠깐 잠겼어요. 조금 뒤에 다시 해 주세요.'};
$('#onLogin').onclick=async()=>{
  const name=$('#onName').value.trim(),pw=$('#onPw').value,code=$('#onClass').value.trim().toUpperCase();const msg=$('#onMsg');msg.textContent='서버에 연결하는 중… (처음엔 1분쯤 걸릴 수 있어요)';
  try{
    if(code){const r=await fetch('/api/class',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});if(!r.ok){msg.textContent='반 코드가 맞지 않거나 닫혀 있어요.';return}}
    const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pw})});const j=await r.json();
    if(!r.ok){msg.textContent=(ERR[j.err]||'입장하지 못했어요.')+(j.left!==undefined?` (남은 기회 ${j.left}번)`:'');return}
    ON.token=j.token;ON.name=j.name;ON.classCode=code;localStorageSet('gt_on_last',j.name);
    // 온라인 기록 불러오기 (혼자 하기 기록과 따로)
    const d=await (await fetch('/api/multi',{headers:{Authorization:'Bearer '+ON.token}})).json();
    enterOnline(j.name,d.data,j.isNew);$('#onPw').value='';msg.textContent='';
  }catch(e){msg.textContent='서버에 연결하지 못했어요. 잠시 뒤 다시 눌러 주세요.'}
};
$('#onPw').addEventListener('keydown',e=>{if(e.key==='Enter')$('#onLogin').click()});

/* ---------- 혼자 하기 함수들을 온라인용으로 감싸기 ---------- */
const saveLocal=window.saveNow, openLobbyLocal=window.openLobby;
function enterOnline(name,data,isNew){
  window.ONLINE_MODE=true;me=name;
  D=merge(DEFAULT_DATA(),data||{});if(!data){D.gold=300}
  saveNow=function(){if(!window.ONLINE_MODE)return saveLocal();clearTimeout(ON.saveT);ON.saveT=setTimeout(pushSave,800)};
  openLobby=function(){if(!window.ONLINE_MODE)return openLobbyLocal();showOnLobby()};
  if(isNew)toast(`${name}님, 온라인에 오신 걸 환영해요! 300G를 드려요`,2600);
  saveNow();connect();showOnLobby();
}
async function pushSave(){try{await fetch('/api/multi',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+ON.token},body:JSON.stringify({data:D})})}catch(e){}}
function leaveOnline(){window.ONLINE_MODE=false;try{ON.ws&&ON.ws.close()}catch(e){}ON.ws=null;ON.token=null;me=null;D=null;saveNow=saveLocal;openLobby=openLobbyLocal;showScreen('#sLogin');renderLogin()}

/* ---------- 연결 ---------- */
function connect(){
  const proto=location.protocol==='https:'?'wss':'ws';
  const ws=new WebSocket(`${proto}://${location.host}/ws?token=${ON.token}`+(ON.classCode?`&class=${ON.classCode}`:''));ON.ws=ws;
  ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch(_){return}onMsg(m)};
  ws.onclose=()=>{if(ON.ws!==ws||!window.ONLINE_MODE)return;ON.ws=null;toast('연결이 끊겼어요. 다시 연결할게요…',2000);setTimeout(()=>{if(window.ONLINE_MODE&&!ON.ws)connect()},Math.min(8000,1500*(++ON.retry)))};
  ws.onopen=()=>{ON.retry=0};
}
function send(o){if(ON.ws&&ON.ws.readyState===1)ON.ws.send(JSON.stringify(o))}
setInterval(()=>send({t:'ping'}),25000);
function onMsg(m){
  switch(m.t){
    case 'hello':ON.you=m.you;ON.channel=m.channel;ON.className=m.className;ON.rooms=m.rooms;ON.online=m.online;$('#olChat').innerHTML='';m.chat.forEach(c=>addChat('#olChat',c));if(m.chatOff)addSys('#olChat','지금은 선생님이 채팅을 꺼 두었어요.');renderLobbyOn();break;
    case 'rooms':ON.rooms=m.rooms;ON.online=m.online;renderLobbyOn();break;
    case 'room':{const was=ON.room;ON.room=m.room;if(!was||was.id!==m.room.id){$('#orChat').innerHTML=''}if(m.room.state==='wait'||!was)showRoom();renderRoom();break}
    case 'left':ON.room=null;if(m.why)toast(m.why);showOnLobby();break;
    case 'chat':addChat(m.scope==='room'?'#orChat':'#olChat',m);break;
    case 'sys':addSys(ON.room?'#orChat':'#olChat',m.text);break;
    case 'err':toast(m.text,2200);$('#orMsg').textContent=m.text;break;
    case 'start':onStart(m);break;
    case 'dup':toast('다른 창에서 같은 이름으로 들어와서 이 창은 연결을 끊어요.',3000);ON.ws=null;break;
    case 'auth_fail':toast('다시 입장해 주세요.');leaveOnline();break;
    case 'class_fail':toast('반 코드가 닫혔어요. 다시 입장해 주세요.',3000);leaveOnline();break;
  }
}
function addChat(box,c){const el=$(box);const d=document.createElement('div');d.innerHTML=`<b>${esc(c.n)}</b> ${esc(c.text)}`;el.appendChild(d);el.scrollTop=el.scrollHeight;while(el.children.length>80)el.firstChild.remove()}
function addSys(box,t){const el=$(box);const d=document.createElement('div');d.className='sys';d.textContent='· '+t;el.appendChild(d);el.scrollTop=el.scrollHeight}

/* ---------- 로비 ---------- */
function showOnLobby(){if(ON.room){showRoom();return}showScreen('#sOnLobby');$('#sOnLobby').classList.remove('hidden');renderLobbyOn()}
['#sOnLobby','#sOnRoom'].forEach(id=>SCREENS.push(id));
function renderLobbyOn(){if(!D)return;
  const ri=rankOf(D.honor);
  $('#olWho').innerHTML=`<b>${esc(me)}</b> 님 · ${ON.className?`<span class="on-badge">${esc(ON.className)} 학급 모임방</span>`:'모두의 로비'}`;
  $('#olGold').textContent=D.gold+'G';$('#olRank').textContent=`${RANKS[ri][0]} · 명예 ${D.honor}`;
  const box=$('#olRooms');box.innerHTML='';
  if(!ON.rooms.length)box.innerHTML='<div class="sub">아직 방이 없어요. ‘방 만들기’를 눌러 보세요!</div>';
  ON.rooms.forEach(r=>{const d=document.createElement('div');d.className='on-room';
    d.innerHTML=`<div><b>${esc(r.name)}</b><div class="sub">${r.mode==='team'?'팀전':'개인전'} · ${MAPNAME[r.map]} · ${DATANAME[r.data]} · 사람 ${r.n}${r.ai?` + 컴퓨터 ${r.ai}`:''} / ${r.max}</div></div>`;
    const b=document.createElement('button');b.className='btn '+(r.state==='wait'?'green':'ghost');b.textContent=r.state==='wait'?'들어가기':'대전 중';b.disabled=r.state!=='wait';b.onclick=()=>send({t:'join',id:r.id});d.appendChild(b);box.appendChild(d)});
  $('#olCount').textContent=`(${ON.online.length}명)`;$('#olUsers').textContent='접속: '+ON.online.map(u=>u.name+(u.room?'(방)':'')).join(', ');
}
function quick(box,scope){const el=$(box);el.innerHTML='';QUICK.forEach(q=>{const b=document.createElement('button');b.className='chip';b.textContent=q;b.onclick=()=>send({t:'chat',text:q,scope});el.appendChild(b)})}
quick('#olQuick','lobby');quick('#orQuick','room');
function chatSend(inp,scope){const v=$(inp).value.trim();if(!v)return;send({t:'chat',text:v,scope});$(inp).value=''}
$('#olSend').onclick=()=>chatSend('#olText','lobby');$('#olText').addEventListener('keydown',e=>{if(e.key==='Enter')chatSend('#olText','lobby')});
$('#orSend').onclick=()=>chatSend('#orText','room');$('#orText').addEventListener('keydown',e=>{if(e.key==='Enter')chatSend('#orText','room')});
$('#olCreate').onclick=()=>send({t:'create',name:`${me}의 방`,max:4,mode:'solo',map:'random',rounds:3,data:D.set.data||'phon',turn:20});
$('#olQuiz').onclick=()=>openQuiz({title:'문제 풀고 골드 받기',earn:true});
$('#olShop').onclick=()=>{shopBack='#sOnLobby';openShop()};
$('#olUp').onclick=()=>{showScreen('#sUpgrade');renderUpgrade()};
$('#olMake').onclick=()=>{makeMode='screen';mkSet=D.set.data;showScreen('#sMake');renderMake()};
$('#olOut').onclick=()=>leaveOnline();
// 상점에서 돌아올 때
const shBack=$('#shBack').onclick;$('#shBack').onclick=()=>{if(window.ONLINE_MODE){if(ON.room)showRoom();else showOnLobby();return}shBack()};
// 골드 표시 갱신에 온라인 로비도 포함
const rgv=window.refreshGoldViews;refreshGoldViews=function(){rgv();if(window.ONLINE_MODE&&D)$('#olGold').textContent=D.gold+'G'};

/* ---------- 방 ---------- */
function showRoom(){hideAllScreens();$('#sOnRoom').classList.remove('hidden')}
function chipsTo(box,items,cur,cb,enabled){const el=$(box);el.innerHTML='';items.forEach(([v,l])=>{const b=document.createElement('button');b.className='chip'+(String(v)===String(cur)?' on':'');b.textContent=l;b.disabled=!enabled;b.onclick=()=>cb(v);el.appendChild(b)})}
function renderRoom(){const r=ON.room;if(!r)return;const host=r.host===ON.you.id;const mine=r.slots.find(s=>s.uid===ON.you.id);
  $('#orTitle').textContent=`${r.name} (#${r.id})`;
  $('#orInfo').innerHTML=`${r.mode==='team'?'팀전 (4인 1팀까지)':'개인전'} · 맵 ${MAPNAME[r.map]} · 라운드 ${r.rounds} · 턴 ${r.turn}초 · 문제 ${DATANAME[r.data]} · ${r.slots.length}/${r.max}명`+(r.state==='playing'?' · <b>대전 중</b>':'');
  $('#orHostSet').classList.toggle('hidden',!host||r.state!=='wait');
  if(host){chipsTo('#orMode',[['solo','개인전'],['team','팀전']],r.mode,v=>send({t:'set',mode:v}),true);
    chipsTo('#orMax',(r.mode==='team'?[2,4,6,8]:[2,3,4,5,6,7,8]).map(n=>[n,r.mode==='team'?`${n/2}:${n/2}`:n+'명']),r.max,v=>send({t:'set',max:v}),true);
    chipsTo('#orRounds',[[1,'1'],[3,'3'],[5,'5']],r.rounds,v=>send({t:'set',rounds:v}),true);
    chipsTo('#orTurn',[[15,'15초'],[20,'20초'],[30,'30초']],r.turn,v=>send({t:'set',turn:v}),true);
    chipsTo('#orMap',Object.keys(MAPNAME).map(k=>[k,MAPNAME[k]]),r.map,v=>send({t:'set',map:v}),true);
    chipsTo('#orData',Object.keys(DATANAME).map(k=>[k,DATANAME[k]]),r.data,v=>send({t:'set',data:v}),true)}
  const box=$('#orSlots');box.innerHTML='';
  for(let i=0;i<r.max;i++){const s=r.slots[i];const d=document.createElement('div');
    if(!s){d.className='on-slot empty';d.textContent='빈자리';box.appendChild(d);continue}
    d.className='on-slot'+(s.ready||s.uid===r.host?' ready':'')+(r.mode==='team'?' t'+s.team:'');
    d.innerHTML=`<b>${esc(s.name)}</b>${s.uid===r.host?'<span class="on-tag">방장</span>':''}${s.ai?'<span class="on-tag">컴퓨터</span>':''}${s.away?'<span class="on-tag">연결 끊김</span>':''}
      <div class="sub">${r.mode==='team'?(s.team===0?'🔵 파랑 팀':'🔴 빨강 팀'):''} ${s.ai?'':s.uid===r.host?'':s.ready?'준비 완료':'기다리는 중'}</div>`;
    if(host&&!s.ai&&s.uid!==ON.you.id&&r.state==='wait'){const k=document.createElement('button');k.className='chip';k.textContent='내보내기';k.style.marginTop='4px';k.onclick=()=>send({t:'kick',uid:s.uid});d.appendChild(k)}
    box.appendChild(d)}
  if(r.mode==='team'){[...box.children].sort((a,b)=>(a.classList.contains('t1')?1:0)-(b.classList.contains('t1')?1:0)).forEach(el=>box.appendChild(el))}
  const rd=$('#orReady');rd.classList.toggle('hidden',host);rd.textContent=mine&&mine.ready?'준비 취소':'준비';
  $('#orTeam').classList.toggle('hidden',r.mode!=='team');
  ['#orFill','#orClear','#orStart'].forEach(b=>$(b).classList.toggle('hidden',!host));
  $('#orStart').disabled=r.state!=='wait';$('#orMsg').textContent=r.state==='playing'?'대전 중이에요.':'';
}
$('#orReady').onclick=()=>{const m=ON.room&&ON.room.slots.find(s=>s.uid===ON.you.id);send({t:'ready',v:!(m&&m.ready)})};
$('#orTeam').onclick=()=>{const m=ON.room&&ON.room.slots.find(s=>s.uid===ON.you.id);send({t:'team',team:m&&m.team===0?1:0})};
$('#orFill').onclick=()=>send({t:'fill_ai'});$('#orClear').onclick=()=>send({t:'clear_ai'});
$('#orStart').onclick=()=>send({t:'start'});
$('#orLeave').onclick=()=>send({t:'leave'});
$('#orSupply').onclick=()=>openQuiz({title:'보급 받기',goal:3,earn:false,onDone:()=>{D.items.repairS++;D.items.scope++;saveNow();toast('보급 완료! 수리 키트 소 +1, 조준경 +1')}});

/* ---------- 시작 (3단계에서 서버 대전으로 연결) ---------- */
function onStart(m){
  addSys('#orChat','대전이 시작됐어요! (온라인 대전 화면은 3단계에서 연결됩니다)');
  toast('대전 시작! 온라인 대전 화면은 다음 단계에서 연결돼요',3000);
  if(m.room.host===ON.you.id)setTimeout(()=>send({t:'end'}),2500);
}
})();
