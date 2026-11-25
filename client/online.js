/* =========================================================
   공부하는 탱크 — 온라인 (서버에서 열었을 때만 보임)
   1·2단계: 입장 · 멀티 기록(싱글과 따로) · 로비 · 방 · 채팅 · 반 코드
   3단계: 온라인 대전 (서버가 계산, 휴대폰은 보여 주기)
   ========================================================= */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const ON={token:null,name:null,ws:null,channel:'public',className:'',rooms:[],online:[],room:null,you:null,saveT:0,retry:0,classCode:''};
window.ONLINE=ON;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MAPNAME={random:'랜덤',hills:'언덕 평원',sky:'층층 하늘섬',canyon:'절벽 계곡',towers:'탑과 다리',scorched:'스코치드 협곡',donuts:'도넛 섬',sphinx:'스핑크스 계단',logbridge:'외나무다리',island:'구름 섬',grave:'비석 언덕',wisland:'웜즈 섬',wcave:'웜즈 동굴',cheese:'치즈 섬'};
const DATANAME={phon:'음운의 변동',add1:'덧셈 (한 자리)',add2:'덧셈 (두 자리)',sub1:'뺄셈',gugu:'구구단',div1:'나눗셈',free:'자유 문제',eng:'고1 영단어'};
const QUICK=['안녕!','잘했어!','한 판 더!','문제 풀고 올게','준비됐어?','좋은 게임!'];

/* ---------- 화면 ---------- */
const css=`
.on-col{display:grid;grid-template-columns:1.6fr 1fr;gap:14px}
@media (max-width:760px){.on-col{grid-template-columns:1fr}}
#onBoardWrap{position:fixed;inset:0;background:rgba(5,10,20,.7);z-index:60;display:flex;align-items:center;justify-content:center}#onBoardWrap.hidden{display:none}.on-board{background:#16243d;border-radius:16px;padding:14px;width:min(560px,94vw);max-height:86vh;overflow:auto;color:#fff}.on-board td{padding:4px 6px}
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
  <div class="row" style="justify-content:space-between"><b>🌐 멀티 플레이 (친구들과 온라인)</b><button class="chip" id="bTitleBack2">← 처음으로</button></div>
  <div class="sub">친구들과 방을 만들어 대전해요. 온라인 골드·장비는 혼자 하기와 따로예요.</div>
  <label class="f"><span class="gnum">1</span>학번과 이름</label><input class="inp" id="onName" maxlength="12" placeholder="예: 10305김공부" autocomplete="off">
  <div class="guide"><span class="gnum">1</span>학번과 이름을 쓰세요. <small>예: 10305김공부 (띄어 쓰지 않아도 돼요)</small></div>
  <label class="f"><span class="gnum">2</span>내 비밀번호</label><input class="inp" id="onPw" type="password" maxlength="30" placeholder="숫자나 글자 4개 이상" autocomplete="off">
  <div class="guide warn"><span class="gnum">2</span>접속할 비밀번호를 넣어 주세요. <small>비밀번호를 잊으면 다시 접속할 수 없어요! 꼭 기억해 두세요.</small></div>
  <label class="f"><span class="gnum">3</span>반 코드</label><input class="inp" id="onClass" maxlength="8" placeholder="없으면 비워 두세요" autocomplete="off" style="text-transform:uppercase">
  <div class="guide"><span class="gnum">3</span>선생님이 알려 준 반 코드를 적어 주세요. <small>학급 활동이 아닌 경우에는 안 적어도 돼요. 반 코드를 적지 않으면 전체 공간에서 플레이하게 돼요.</small></div>
  <div class="row" style="margin-top:12px"><button class="btn big" id="onLogin" style="flex:1">온라인 입장</button></div>
  <div class="guide"><span class="gnum">4</span>다 적었으면 「온라인 입장」! <small>처음이면 이 이름으로 계정이 새로 만들어지고, 다음부터는 같은 이름·비밀번호로 들어와요.</small></div>
  <div class="sub" id="onMsg" style="margin-top:8px;min-height:20px"></div>
</div>
<div id="sOnLobby" class="screen hidden"><div class="wrap">
  <div class="row" style="justify-content:space-between">
    <div><h1 style="font-size:28px">스터디 탱크 <span class="on-badge">온라인</span></h1><div class="sub" id="olWho"></div></div>
    <div style="text-align:right"><div class="goldtag" style="font-size:22px" id="olGold">0G</div><div class="sub" id="olRank"></div></div>
  </div>
  <div class="row" style="margin-top:10px">
    <button class="btn big green" id="olCreate">방 만들기</button>
    <button class="btn orange claimBtn hidden" id="olClaim"></button><button class="btn orange" id="olQuiz">📝 문제 풀고 골드</button><button class="btn" id="olVocab" style="background:#2f7fe0">📘 고1 영단어</button>
    <button class="btn" id="olShop">🛒 상점</button><button class="btn" id="olUp">🔧 강화</button><button class="btn" id="olMake">✏️ 문제 만들기</button>
    <button class="btn ghost" id="olTut">❓ 처음 안내</button><button class="btn ghost" id="olOut">나가기</button>
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
  <div class="go-row"><button class="go-btn" id="orStart">▶ 게임 시작!</button><button class="go-btn ready" id="orReady">✋ 준비</button></div>
  <div class="sub" id="orReadyInfo" style="margin-top:6px;text-align:center"></div>
  <div class="row" style="margin-top:12px">
    <button class="btn" id="orTeam">팀 바꾸기</button>
    <button class="btn" id="orFill">빈자리 컴퓨터로 채우기</button>
    <button class="btn ghost" id="orClear">컴퓨터 빼기</button>
    <button class="btn orange" id="orSupply">📝 보급 받기 (3문제)</button>
  </div>
  <div class="row" style="margin-top:8px">
    <button class="btn orange claimBtn hidden" id="orClaim"></button>
    <button class="btn orange" id="orQuiz">📝 문제 풀고 골드</button>
    <button class="btn" id="orShop">🛒 상점</button>
    <button class="btn" id="orUp">🔧 강화</button>
    <button class="btn" id="orVocab" style="background:#2f7fe0">📘 고1 영단어</button>
    <button class="btn ghost" id="orTut">❓ 처음 안내</button>
  </div>
  <div class="sub" id="orMsg" style="margin-top:8px;min-height:20px"></div>
  <h3>방 채팅</h3><div class="on-chat" id="orChat" style="height:160px"></div>
  <div class="chips" id="orQuick" style="margin-top:6px"></div>
  <div class="row" style="margin-top:6px;flex-wrap:nowrap"><input class="inp" id="orText" maxlength="120" placeholder="방 채팅"><button class="btn" id="orSend">보내기</button></div>
</div></div>`;
document.body.insertAdjacentHTML('beforeend',html);
$('#singleCard').after($('#onChoose'));$('#bTitleBack2').onclick=()=>showTitle();

/* ---------- 서버에서 열렸는지 확인 ---------- */
fetch('/healthz',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>{if(j&&j.ok){window.ONLINE_AVAILABLE=true;const last=localStorageGet('gt_on_last');if(last)$('#onName').value=last}}).catch(()=>{});
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
function leaveOnline(){window.ONLINE_MODE=false;try{const v=JSON.parse(localStorage.getItem('gt_grades')||'null');setVisGrades(Array.isArray(v)?v:null,false)}catch(e){setVisGrades(null,false)}try{ON.ws&&ON.ws.close()}catch(e){}ON.ws=null;ON.token=null;me=null;D=null;saveNow=saveLocal;openLobby=openLobbyLocal;showScreen('#sLogin');renderLogin()}

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
    case 'my_tier':if(ON.you){ON.you.tier=m.tier;renderLobbyOn()}break;
    case 'rank':showBoard(m);break;
    case 'grades':setVisGrades(m.grades,false);toast('선생님이 고를 수 있는 문제 범위를 바꿨어요',2200);if(ON.room)renderRoom();break;
    case 'hello':if(m.grades)setVisGrades(m.grades,false);ON.you=m.you;ON.channel=m.channel;ON.className=m.className;ON.rooms=m.rooms;ON.online=m.online;$('#olChat').innerHTML='';m.chat.forEach(c=>addChat('#olChat',c));if(m.chatOff)addSys('#olChat','지금은 선생님이 채팅을 꺼 두었어요.');renderLobbyOn();break;
    case 'rooms':ON.rooms=m.rooms;ON.online=m.online;renderLobbyOn();break;
    case 'room':{const was=ON.room;ON.room=m.room;if(!was||was.id!==m.room.id){$('#orChat').innerHTML=''}if(!(G&&G.online)&&(m.room.state==='wait'||!was))showRoom();renderRoom();break}
    case 'left':ON.room=null;if(m.why)toast(m.why);showOnLobby();break;
    case 'chat':addChat(m.scope==='room'?'#orChat':'#olChat',m);break;
    case 'sys':addSys(ON.room?'#orChat':'#olChat',m.text);break;
    case 'err':toast(m.text,2200);$('#orMsg').textContent=m.text;break;
    case 'start':onStart(m);break;
    default:if(m.t&&m.t.startsWith('b_')&&window.__onBattle)window.__onBattle(m);break;
    case 'dup':toast('다른 창에서 같은 이름으로 들어와서 이 창은 연결을 끊어요.',3000);ON.ws=null;break;
    case 'auth_fail':toast('다시 입장해 주세요.');leaveOnline();break;
    case 'class_fail':toast('반 코드가 닫혔어요. 다시 입장해 주세요.',3000);leaveOnline();break;
  }
}
function addChat(box,c){const el=$(box);const d=document.createElement('div');d.innerHTML=`<b>${esc(c.n)}</b> ${esc(c.text)}`;el.appendChild(d);el.scrollTop=el.scrollHeight;while(el.children.length>80)el.firstChild.remove()}
function addSys(box,t){const el=$(box);const d=document.createElement('div');d.className='sys';d.textContent='· '+t;el.appendChild(d);el.scrollTop=el.scrollHeight}

/* ---------- 로비 ---------- */
function showOnLobby(){if(ON.room){showRoom();return}showScreen('#sOnLobby');$('#sOnLobby').classList.remove('hidden');renderLobbyOn();setTimeout(()=>{if(!$('#sOnLobby').classList.contains('hidden'))tutMaybe('olobby')},1800)}
['#sOnLobby','#sOnRoom'].forEach(id=>SCREENS.push(id));
function renderLobbyOn(){if(!D)return;
  const ri=rankOf(D.honor);
  $('#olWho').innerHTML=`<b>${esc(me)}</b> 님 · ${ON.className?`<span class="on-badge">${esc(ON.className)} 학급 모임방</span>`:'모두의 로비'}`;
  $('#olGold').textContent=D.gold+'G';const T=ON.you&&ON.you.tier;$('#olRank').innerHTML=T?`${tierBadge(T)} `+(T.rank?`${T.of}명 중 ${T.rank}등 · ${T.r}점 · <u>순위표</u>`:`첫 판을 하면 티어가 생겨요 · <u>순위표</u>`):'';void ri;
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
$('#olCreate').onclick=()=>{fixDataChoice();send({t:'create',name:`${me}의 방`,max:4,mode:'solo',map:'random',rounds:3,data:D.set.data||'phon',turn:20})};
$('#olQuiz').onclick=()=>openQuiz({title:'문제 풀고 골드 받기',earn:true});
$('#olVocab').onclick=()=>openVocab('#sOnLobby');
// 방 안에서 상점·강화·문제 풀기 (방을 나가지 않음). 준비한 상태로 가면 준비가 풀림 → 다 사고 다시 준비
function roomUnready(){const r=ON.room;if(!r)return;const m=r.slots.find(s=>s.uid===ON.you.id);if(m&&m.ready&&r.host!==ON.you.id){send({t:'ready',v:false});toast('준비가 풀렸어요. 다 끝나면 다시 「준비」를 눌러요',2400)}}
$('#orShop').onclick=()=>{roomUnready();shopBack='#sOnRoom';openShop()};
$('#orUp').onclick=()=>{roomUnready();showScreen('#sUpgrade');renderUpgrade()};
$('#orQuiz').onclick=()=>openQuiz({title:'문제 풀고 골드 받기',earn:true});
$('#orVocab').onclick=()=>openVocab('#sOnRoom');
$('#olTut').onclick=()=>tutMaybe('olobby',true);$('#orTut').onclick=()=>tutMaybe('room',true);
$('#olShop').onclick=()=>{shopBack='#sOnLobby';openShop()};
$('#olUp').onclick=()=>{showScreen('#sUpgrade');renderUpgrade()};
$('#olMake').onclick=()=>{makeMode='screen';mkSet=D.set.data;showScreen('#sMake');renderMake()};
$('#olOut').onclick=()=>leaveOnline();
// 상점에서 돌아올 때
const shBack=$('#shBack').onclick;$('#shBack').onclick=()=>{if(window.ONLINE_MODE){if(ON.room)showRoom();else showOnLobby();return}shBack()};
// 골드 표시 갱신에 온라인 로비도 포함
const rgv=window.refreshGoldViews;refreshGoldViews=function(){rgv();if(window.ONLINE_MODE&&D)$('#olGold').textContent=D.gold+'G'};

/* ---------- 방 ---------- */
function showRoom(){hideAllScreens();$('#sOnRoom').classList.remove('hidden');setTimeout(()=>{if(ON.room&&!$('#sOnRoom').classList.contains('hidden'))tutMaybe('room')},500)}
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
    chipsTo('#orData',Object.keys(DATANAME).filter(k=>dataAllowed(k)).sort((x,y)=>{const o={elem:0,mid:1,high:2,all:3};return o[(DATASETS[x]||{}).grade||'all']-o[(DATASETS[y]||{}).grade||'all']}).map(k=>[k,(DATASETS[k]&&DATASETS[k].grade!=='all'?GRADES[DATASETS[k].grade].split(' ')[1]+' · ':'')+DATANAME[k]]),r.data,v=>send({t:'set',data:v}),true)}
  const box=$('#orSlots');box.innerHTML='';
  for(let i=0;i<r.max;i++){const s=r.slots[i];const d=document.createElement('div');
    if(!s){d.className='on-slot empty';d.textContent='빈자리';box.appendChild(d);continue}
    d.className='on-slot'+(s.ready||s.uid===r.host?' ready':'')+(r.mode==='team'?' t'+s.team:'');
    d.innerHTML=`${s.tier&&!s.ai?tierBadge(s.tier)+' ':''}<b>${esc(s.name)}</b>${s.uid===r.host?'<span class="on-tag">방장</span>':''}${s.ai?'<span class="on-tag">컴퓨터</span>':''}${s.away?'<span class="on-tag">연결 끊김</span>':''}
      <div class="sub">${r.mode==='team'?(s.team===0?'🔵 파랑 팀':'🔴 빨강 팀'):''} ${s.ai?'':s.uid===r.host?'':s.ready?'준비 완료':'기다리는 중'}</div>`;
    if(host&&!s.ai&&s.uid!==ON.you.id&&r.state==='wait'){const k=document.createElement('button');k.className='chip';k.textContent='내보내기';k.style.marginTop='4px';k.onclick=()=>send({t:'kick',uid:s.uid});d.appendChild(k);const h=document.createElement('button');h.className='chip';h.textContent='👑 방장 넘기기';h.style.margin='4px 0 0 4px';h.onclick=()=>{if(confirm(s.name+' 님에게 방장을 넘길까요?'))send({t:'host',uid:s.uid})};d.appendChild(h)}
    box.appendChild(d)}
  if(r.mode==='team'){[...box.children].sort((a,b)=>(a.classList.contains('t1')?1:0)-(b.classList.contains('t1')?1:0)).forEach(el=>box.appendChild(el))}
  const rd=$('#orReady');rd.classList.toggle('hidden',host);rd.textContent=mine&&mine.ready?'✅ 준비 완료 (누르면 취소)':'✋ 준비하기';rd.classList.toggle('done',!!(mine&&mine.ready));{const others=r.slots.filter(s=>!s.ai&&s.uid!==r.host),rn=others.filter(s=>s.ready).length;const ri=$('#orReadyInfo');if(ri)ri.innerHTML=r.state!=='wait'?'':(others.length?`준비 ${rn} / ${others.length}명`+(host?(rn===others.length?' · <b style="color:#5be38a">모두 준비 완료! 시작할 수 있어요</b>':' · 모두 준비하면 시작할 수 있어요'):(mine&&mine.ready?' · 방장이 시작하기를 기다려요':' · 상점·문제 풀기를 마치면 「준비」를 눌러요')):'')}
  $('#orTeam').classList.toggle('hidden',r.mode!=='team');
  ['#orFill','#orClear','#orStart'].forEach(b=>$(b).classList.toggle('hidden',!host));{const others=r.slots.filter(s=>!s.ai&&s.uid!==r.host);const all=others.every(s=>s.ready)&&r.slots.length>=2;$('#orStart').classList.toggle('wait',!all);$('#orStart').textContent=all?'▶ 게임 시작!':(r.slots.length<2?'▶ 게임 시작 (2명 이상 필요)':'▶ 게임 시작 (준비 기다리는 중)')}
  $('#orStart').disabled=r.state!=='wait';$('#orMsg').textContent=r.state==='playing'?'대전 중이에요.':'';
}
$('#orReady').onclick=()=>{const m=ON.room&&ON.room.slots.find(s=>s.uid===ON.you.id);send({t:'ready',v:!(m&&m.ready)})};
$('#orTeam').onclick=()=>{const m=ON.room&&ON.room.slots.find(s=>s.uid===ON.you.id);send({t:'team',team:m&&m.team===0?1:0})};
$('#orFill').onclick=()=>send({t:'fill_ai'});$('#orClear').onclick=()=>send({t:'clear_ai'});
$('#orStart').onclick=()=>send({t:'start'});
$('#orLeave').onclick=()=>send({t:'leave'});
$('#orSupply').onclick=()=>openQuiz({title:'보급 받기',goal:3,earn:false,onDone:()=>{D.items.repairS++;D.items.scope++;saveNow();toast('보급 완료! 수리 키트 소 +1, 조준경 +1')}});

/* =========================================================
   3단계: 온라인 대전 — 서버가 계산한 결과를 받아 그대로 보여 준다
   ========================================================= */
const TE=window.TankEngine;
const BT={pmap:new Map(),play:null,lastPos:0,posKey:'',fell:false,aiAim:null,myI:-1};
const NAMEW=k=>(WEAPONS[k]||WEAPONS.basic).name;
function sendLoadout(){if(!D)return;send({t:'loadout',up:{armor:D.up.armor|0,barrel:D.up.barrel|0,engine:D.up.engine|0},startShield:(D.items.startShield||0)>0})}
function onStart(m){addSys('#orChat','대전 시작! 맵을 만드는 중…');const r=m.room||ON.room;BT.eng=!!(r&&r.data==='eng');
  if(BT.eng){D.gold=Math.max(0,D.gold-ENG_FEE);saveNow();toast(`📘 영단어 버전: 참가비 ${ENG_FEE}G를 냈어요. 보상은 경기가 끝나고 영단어 ${ENG_CLAIM}문제로 받아요`,3200)}else toast('대전 시작!',1500)}

// 서버와 같은 맵을 만들고, 혼자 하기와 같은 색으로 칠한다
function buildTerrain(world){
  WW=world.WW;WH=world.WH;solid=world.solid;bedrockY=world.bedrockY;mapKind=world.kind;valleys=world.valleys;theme=THEMES[world.themeIdx%THEMES.length];
  const R=TE.rng(world.seed+7);hillSeed=[R()*6,R()*6,R()*6];
  terrain=document.createElement('canvas');terrain.width=WW;terrain.height=WH;tctx=terrain.getContext('2d');
  const img=tctx.createImageData(WW,WH),d=img.data,mat=world.mat,th=theme;
  const c1=hexRgb(th.d1),c2=hexRgb(th.d2),ct=hexRgb(th.top),st=[126,130,142],wd=[156,108,62];
  for(let x=0;x<WW;x++){let depth=-1;
    for(let y=0;y<WH;y++){const i=y*WW+x,j=i*4,m=mat[i];
      if(m){depth=depth<0?0:depth+1;const nz=((x*73856093^y*19349663)>>>0)%23-11;let col;
        if(m===3){col=wd;const dark=(x%64<2)||depth>=17;col=[col[0]-(dark?35:0)+nz,col[1]-(dark?30:0)+nz,col[2]-(dark?20:0)+nz];if(depth<4)col=[ct[0],ct[1],ct[2]]}
        else if(m===2){const row=Math.floor(y/26);const mortar=(y%26<2)||((x+(row%2)*24)%48<2);col=mortar?[90,92,102]:[st[0]+nz,st[1]+nz,st[2]+nz]}
        else{const t=y/WH;col=[c1[0]+(c2[0]-c1[0])*t+nz,c1[1]+(c2[1]-c1[1])*t+nz,c1[2]+(c2[2]-c1[2])*t+nz];if(depth<7)col=ct}
        d[j]=col[0];d[j+1]=col[1];d[j+2]=col[2];d[j+3]=255}
      else depth=-1}}
  tctx.putImageData(img,0,0);miniDirty=true;WEAPONS.nuke.r=world.nukeR;
}
function mkTank(v,players){const p=players[v.i]||(players[v.i]={name:v.name,points:0,kills:0,dmg:0,isAI:v.isAI});
  return {i:v.i,uid:v.uid,p,team:v.team,name:v.name,color:v.color,isAI:v.isAI,x:v.x,y:v.y,vx:0,vy:0,air:false,peak:v.y,hp:v.hp,hpMax:v.hpMax,alive:v.alive,angle:v.angle,
    dmgMul:v.dmgMul,fuelMax:v.fuelMax,fuel:0,shield:v.shield,rainbow:v.rainbow,chute:v.chute,spider:v.spider,rot:v.rot||0,roundKills:v.roundKills||0,tier:v.tier||null,lastHit:null,deathOrder:0,tx:v.x,ty:v.y}}
function setFromView(t,v){Object.assign(t,{x:v.x,y:v.y,tx:v.x,ty:v.y,hp:v.hp,alive:v.alive,shield:v.shield,rainbow:v.rainbow,chute:v.chute,spider:v.spider,rot:v.rot||0,isAI:v.isAI});if(t!==G.me||G.cur!==G.me)t.angle=v.angle;t.vx=0;t.vy=0;t.air=false}

function onRound(info){
  BT.eng=!!(ON.room&&ON.room.data==='eng');
  if(info.round===1)setTimeout(()=>{if(G&&G.online)tutMaybe('battle')},900);
  if(typeof QZ!=='undefined'&&QZ)closeQuiz();
  const world=TE.genWorld(info.seed,info.mapArg,info.tanks.length);buildTerrain(world);
  const players=G&&G.online&&G.players?G.players:[];
  G={online:true,players,round:info.round,totalRounds:info.total,teamMode:info.teamMode,teamWins:info.teamWins.slice(),matchGold:G&&G.online?G.matchGold:0,
    proj:[],delayed:[],crates:info.crates.map(c=>({id:c.id,x:c.x,y:c.y,ty:c.y,landed:true})),parts:[],texts:[],ghost:null,state:'wait',turn:-1,cycle:1,
    roundGold:{},roundGoldTotal:0,doubled:false,weapon:'basic',shake:0,flash:0,panHold:0,timer:0,wind:0,turnSec:info.turnSec,twisters:info.tw||[],env:info.env||{list:[],water:null}};
  G.tanks=info.tanks.map(v=>mkTank(v,players));
  BT.myI=G.tanks.findIndex(t=>t.uid===ON.you.id);G.me=G.tanks[BT.myI]||G.tanks[0];G.cur=null;BT.pmap.clear();BT.play=null;BT.fell=false;BT.aiAim=null;
  document.body.classList.add('battle');hideAllScreens();$('#hud').classList.remove('hidden');
  cam.z=0.8;cam.x=G.me.x;cam.y=G.me.y-150;G.teleArm=false;mapView=null;$('#bMap').textContent='🗺 전체 맵';
  addText(G.me.x,G.me.y-80,`라운드 ${G.round} · ${MAPS[world.kind].name}`,'#fff',2.4,26);
  addText(G.me.x,G.me.y-50,G.teamMode?(G.me.team===0?'나는 🔵 파랑 팀':'나는 🔴 빨강 팀'):'내 탱크는 여기!','#bfe2ff',2.4,18);
  if(G.me.shield&&!G.me.isAI&&D.items.startShield>0){D.items.startShield--;saveNow();addText(G.me.x,G.me.y-110,`시작 방어막 켜짐! (남은 ${D.items.startShield}개)`,'#8ff',2.2,18)}
  updateHud();
}
function onTurn(m){if(!G||!G.online)return;finishPlay();if(typeof wordTipNext==='function')wordTipNext();if(m.tw)G.twisters=m.tw;if(m.env)G.env=m.env;if(m.twNew&&typeof addText==='function'){const t=m.tw[m.tw.length-1];if(t)addText(t.x,t.base-t.h-20,m.twNew===2?'🔥 불꽃 회오리 등장! 피해 2배':'🌪 회오리 등장!',m.twNew===2?'#ff8a3d':'#d8ecff',2.2,22)}
  const t=G.tanks[m.i];G.turn=m.i;G.cur=t;G.wind=m.wind;G.cycle=m.cycle;G.timer=m.ms/1000;G.timerMax=G.timer;G.camManual=false;if(m.i===BT.myI&&m.ms>0&&typeof myTurnBanner==='function')setTimeout(myTurnBanner,300);
  G.state=(t===G.me&&t.isAI)?'wait':'aim';G.scope=false;G.double=false;G.warp=false;G.teleArm=false;G.repairUsed=false;aim=null;closeTray();
  for(const o of G.tanks)if(o.rope)releaseRope(o,true);G.ropeArm=false;ropeV=0;
  t.fuel=t.fuelMax;BT.fell=false;BT.posKey='';
  if(m.extra){if(m.extra.survive&&G.me.alive&&!G.me.isAI)myGold('생존',m.extra.survive);
    if(m.extra.crate){G.crates.push({id:m.extra.crate.id,x:m.extra.crate.x,y:mapKind==='wcave'?m.extra.crate.y-200:-60,ty:m.extra.crate.y,landed:false});addText(t.x,t.y-90,'하늘에서 보급 상자가 내려와요!','#ffd43b',2,18)}}
  if(t===G.me&&!t.isAI){sfx('ok');if(mapView){cam.z=mapView.z;mapView=null;$('#bMap').textContent='🗺 전체 맵'}G.panHold=0}
  updateHud()}
function myGold(l,a){if(a<=0)return;G.roundGold[l]=(G.roundGold[l]||0)+a;G.roundGoldTotal+=a;if(l!=='피해 보상'){addText(G.me.x,G.me.y-60,`+${a}G ${l}`,'#ffd43b',1.6,18);sfx('coin')}}

/* ---- 사건 하나 보여 주기 (폭발 · 피해 · 격파 · 상자 · 골드) ---- */
function boomFx(e){const W=WEAPONS[e.w]||{r:e.r};const r=e.r;
  if(e.dirt){addDirt(e.x,e.y,r);for(const t of G.tanks)if(t.alive&&Math.hypot(t.x-e.x,t.y-10-e.y)<r)addText(t.x,t.y-46,'흙에 묻힘!','#ffe8b0',1.2,16);
    for(let i=0;i<Math.round(r*0.5);i++)G.parts.push({x:e.x,y:e.y,vx:rand(-r*2,r*2),vy:rand(-r*3.5,-40),life:0.9,max:0.9,size:rand(3,8),color:theme.d1,grav:500});G.shake=Math.min(14,r/8);sfx('boom');return}
  carve(e.x,e.y,r);addBoomSprite(e.x,e.y,r);G.shake=Math.max(G.shake||0,Math.min(e.w==='nuke'?30:18,r/3));sfx(r>50?'bigboom':'boom');
  if(e.w==='nuke'){addText(e.x,e.y-90,'💥','#fff',1.5,60);G.flash=0.9;G.shake=30;for(let i=0;i<70;i++){const a=rand(Math.PI*1.1,Math.PI*1.9),sp=rand(80,420);G.parts.push({x:e.x+rand(-40,40),y:e.y,vx:Math.cos(a)*sp*0.5,vy:Math.sin(a)*sp,life:rand(1,2),max:2,size:rand(14,30),color:i%2?'rgba(255,170,60,.55)':'rgba(90,80,80,.5)',grav:-40})}}
  if(e.w==='tri3')G.shake=20;
  const n=Math.min(120,Math.round(r*0.9));for(let i=0;i<n;i++){const a=rand(0,7),s=rand(40,320);G.parts.push({x:e.x,y:e.y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:rand(0.4,0.9),max:0.9,size:rand(3,8),color:Math.random()<0.5?'#ffb347':'#ff6b3d',grav:300})}
  for(let i=0;i<14;i++)G.parts.push({x:e.x+rand(-r/2,r/2),y:e.y+rand(-r/2,r/2),vx:rand(-30,30),vy:rand(-60,-20),life:1.2,max:1.2,size:rand(8,16),color:'rgba(80,80,80,.5)',grav:-30});
  void W}
function applyEv(e){const t=e.i!==undefined?G.tanks[e.i]:null;
  switch(e.e){
    case 'boom':boomFx(e);break;
    case 'hit':if(!t)break;
      if(e.rb!==undefined&&!e.d){t.rainbow=e.rb;addText(t.x,t.y-58,e.rb?`무지개 방어막! (남은 ${e.rb}번)`:'무지개 방어막 깨짐!','#ffd6ff',1.2,16);break}
      if(e.sh){t.shield=false;addText(t.x,t.y-58,'방어막!','#8ff',1,16)}
      if(e.cov)addText(t.x,t.y-76,'엄폐! 피해 '+e.cov+'% 줄임','#bfe2ff',1.4,14);
      t.hp=e.hp;addText(t.x+rand(-8,8),t.y-44,'-'+e.d,'#ff6b6b',1.2,20);break;
    case 'ff':if(e.by===BT.myI)addText(t.x,t.y-60,'아군이에요!','#ffb3b3',1,14);break;
    case 'kill':{if(!t)break;t.alive=false;t.hp=0;const k=G.tanks[e.by];if(k&&k!==t){k.roundKills++;k.p.kills++}
      if(e.why==='fall'){const wy=G.env&&G.env.water!=null?G.env.water:WH;addText(t.x,wy-40,'풍덩! 물에 빠졌어요','#bfe9ff',1.6,22);for(let i=0;i<24;i++)G.parts.push({x:t.x,y:WH-10,vx:rand(-140,140),vy:rand(-320,-120),life:0.8,max:0.8,size:rand(3,7),color:'#bfe9ff',grav:600})}
      addText(t.x,Math.min(t.y,WH-40)-70,t===G.me?'내 탱크 격파…':'격파!','#fff',1.6,24);G.shake=16;sfx('bigboom');
      for(let i=0;i<50;i++){const a=rand(0,7),s=rand(60,380);G.parts.push({x:t.x,y:Math.min(t.y,WH)-10,vx:Math.cos(a)*s,vy:Math.sin(a)*s-100,life:rand(0.6,1.2),max:1.2,size:rand(3,9),color:i%3?t.color:'#ffb347',grav:400})}break}
    case 'split':addText(e.x,e.y-(e.big?30:20),e.big?'대분열!!':'분열!',e.big?'#ffd43b':'#fff',e.big?1.2:0.8,e.big?26:16);if(e.big)G.shake=8;break;
    case 'warp':if(!t)break;for(let i=0;i<16;i++)G.parts.push({x:e.x,y:e.y-10,vx:rand(-90,90),vy:rand(-90,90),life:0.6,max:0.6,size:5,color:'#c9a6ff',grav:0});addText(e.x,e.y-50,'도착!','#c9a6ff',1.2,18);sfx('ok');break;
    case 'crate':{const c=G.crates.find(c=>c.id===e.id);G.crates=G.crates.filter(c=>c.id!==e.id);const k=e.item;let label=k==='gold'?'+150G':k==='repair'?'수리 키트 중':NAMEW(k);
      if(e.i===BT.myI&&!G.me.isAI){if(k==='repair'){D.items.repair=(D.items.repair||0)+1;saveNow()}else if(k!=='gold'){D.ammo[k]=(D.ammo[k]||0)+1;saveNow()}}
      const x=c?c.x:(t?t.x:0),y=c?c.y:(t?t.y:0);addText(x,y-40,`${e.i===BT.myI?'획득!':(t?t.name:'')+' 획득'} ${label}`,'#ffd43b',2,20);sfx('coin');break}
    case 'crate_gone':G.crates=G.crates.filter(c=>c.id!==e.id);break;
    case 'gold':if(e.i===BT.myI&&!G.me.isAI)myGold(e.l,e.a);break;
    case 'text':addText(e.x,e.y,e.s,e.c,1.4,e.z);break;
    case 'fire2':sfx('fire');break;
    case 'fill':fillRectT(e.x1,e.y1,e.x2,e.y2);break;
    case 'clear':clearRectT(e.x1,e.y1,e.x2,e.y2);break;
    case 'splash':splashFx(e.x,e.y);break;
    case 'envset':{const o=G.env&&G.env.list.find(o=>o.id===e.id);if(o)o.hp=e.hp;break}
    case 'envgone':if(G.env)G.env.list=G.env.list.filter(o=>o.id!==e.id);break;
    case 'envhp':{const o=G.env&&G.env.list.find(o=>o.id===e.id);if(o)o.hp=e.hp;addText(e.x+rand(-20,20),e.y-30,'-'+e.d,'#ffb3b3',1,20);break}
    case 'prize':{if(G.env)G.env.list=G.env.list.filter(o=>o.id!==e.id);const mine=e.i===BT.myI&&!G.me.isAI;const nm=t?t.name:'';
      if(e.src==='balloon'){popFx(e.x,e.y,'#ffd43b');sfx('coin');if(mine&&e.item!=='gold'){D.ammo[e.item]=(D.ammo[e.item]||0)+1;saveNow()}addText(e.x,e.y-40,`🎁 ${mine?'획득!':nm+' 획득'} ${envPrizeName(e.item)}`,'#ffd43b',2,20)}
      else if(e.src==='qbox'){popFx(e.x,e.y,'#c9a6ff');if(mine){addText(e.x,e.y-40,'❓ 퀴즈 상자 열림! 문제를 맞혀요','#e5d4ff',2,20);envQuizPrize()}else addText(e.x,e.y-40,e.item==='none'?`❓ ${nm} 오답!`:e.item==='quiz'?`❓ ${nm} 퀴즈 상자 열림!`:`❓ ${nm} 정답! ${envPrizeName(e.item)}`,'#e5d4ff',2,18)}
      else if(e.src==='boss'){G.shake=18;popFx(e.x,e.y,'#ffd43b');popFx(e.x,e.y,'#ff6b3d');sfx('bigboom');addText(e.x,e.y-40,`👑 보스 격추! ${mine?'+500G':nm}`,'#ffe08a',2.4,28)}
      break}
  }}

/* ---- 발사 장면 다시 보기 ---- */
function onShot(m){if(!G||!G.online)return;finishPlay();aim=null;
  const t=G.tanks[m.i];t.angle=m.a;t.showPow=0;BT.aiAim=null;
  if(t.isAI||t!==G.me)addText(t.x,t.y-56,m.warp?'이동 포탄':NAMEW(m.w),'#fff',1,14);
  const mz=t;for(let i=0;i<10;i++)G.parts.push({x:mz.x+Math.cos(m.a)*22,y:mz.y-10+Math.sin(m.a)*22,vx:Math.cos(m.a)*rand(40,160)+rand(-30,30),vy:Math.sin(m.a)*rand(40,160)+rand(-30,30),life:0.4,max:0.4,size:rand(3,6),color:'rgba(230,230,230,.8)',grav:-20});
  sfx('fire');BT.pmap.clear();
  BT.play={t:0,k:0,j:0,res:m.res,final:m.final,mine:t===G.me,track:[]};G.state='fly';G.panHold=0;updateHud()}
function onEnv(m){if(!G||!G.online)return;finishPlay();aim=null;if(m.env)G.env=m.env;
  BT.pmap.clear();BT.play={t:0,k:0,j:0,res:m.res,final:m.final,mine:false,track:[]};G.state='fly';G.panHold=0;if(!m.res.fired)finishPlay()}
function finishPlay(){const P=BT.play;if(!P)return;BT.play=null;
  while(P.j<P.res.ev.length)applyEv(P.res.ev[P.j++]);
  P.final.forEach(v=>{const t=G.tanks[v.i];if(t)setFromView(t,v)});
  if(P.mine&&P.track.length>3)G.ghost=P.track;
  G.proj=[];BT.pmap.clear();G.state='wait'}
function stepPlay(dt){const P=BT.play;if(!P)return;P.t+=dt;const F=P.res.frames;
  while(P.k<F.length-2&&F[P.k+1][0]<=P.t)P.k++;
  const a=F[P.k],b=F[Math.min(F.length-1,P.k+1)];const span=Math.max(1e-6,b[0]-a[0]);const f=clamp((P.t-a[0])/span,0,1);
  // 탱크 위치
  a[2].forEach((pa,i)=>{const t=G.tanks[i];if(!t||!pa)return;const pb=b[2][i]||pa;t.x=pa[0]+(pb[0]-pa[0])*f;t.y=pa[1]+(pb[1]-pa[1])*f;t.rot=pa[2];t.chuteOpen=!!pa[3];t.air=!!pa[3]});
  // 포탄
  const bm=new Map(b[1].map(q=>[q[0],q]));const live=[];
  for(const q of a[1]){const qb=bm.get(q[0])||q;let o=BT.pmap.get(q[0]);if(!o){o={trail:[]};BT.pmap.set(q[0],o)}
    o.x=q[1]+(qb[1]-q[1])*f;o.y=q[2]+(qb[2]-q[2])*f;o.w=q[3];o.trail.push(o.x,o.y);if(o.trail.length>40)o.trail.splice(0,2);live.push(o);
    if(P.mine&&q[0]===a[1][0][0]&&P.track.length<4000)P.track.push(o.x,o.y)}
  G.proj=live;
  while(P.j<P.res.ev.length&&P.res.ev[P.j].t<=P.t)applyEv(P.res.ev[P.j++]);
  if(P.t>=P.res.dur+0.05)finishPlay()}

/* ---- 매 화면마다 (게임 loop 대신) ---- */
window.onlineStep=function(dt){
  if(G.state==='aim'||G.state==='sent'){G.timer=Math.max(0,G.timer-dt);const t=G.cur;
    if(t===G.me&&G.state==='aim'&&t.alive){
      if(moveDir&&!aim&&!QZ)moveTank(t,moveDir,dt);else{t.crawlDir=0;t.crawlSense=0;iceIdle(t,dt)}
      tankPhysics(t,dt);
      if(!t.alive&&!BT.fell){BT.fell=true;send({t:'b_fell'})}
      const now=performance.now();const key=Math.round(t.x)+','+Math.round(t.y)+','+t.angle.toFixed(2);
      if(key!==BT.posKey&&now-BT.lastPos>110){BT.posKey=key;BT.lastPos=now;send({t:'b_pos',x:+t.x.toFixed(1),y:+t.y.toFixed(1),a:+t.angle.toFixed(3),r:+(t.rot||0).toFixed(2)})}
      $('#fuelBar').style.width=(t.fuel/t.fuelMax*100)+'%';const tm=$('#hTimer');if(tm)tm.textContent=Math.ceil(G.timer)}
    else if(t){t.x+=(t.tx-t.x)*Math.min(1,dt*10);t.y+=(t.ty-t.y)*Math.min(1,dt*10)}}
  if(BT.aiAim){const A=BT.aiAim,t=G.tanks[A.i];A.t+=dt;const k=Math.min(1,A.t/0.6);t.angle=A.from+(A.to-A.from)*k;t.showPow=A.pw*k}
  stepPlay(dt);
  // 상자 떨어지기 (보이기만, 줍기는 서버가 정함)
  for(const c of G.crates){if(c.y<c.ty){c.y=Math.min(c.ty,c.y+60*dt);c.landed=c.y>=c.ty}else if(!isSolid(c.x,c.y+1)&&!isSolid(c.x-10,c.y+1)&&!isSolid(c.x+10,c.y+1)&&c.y<WH+20){c.y+=90*dt;c.ty=c.y;c.landed=false}else c.landed=true}
  G.flash=Math.max(0,(G.flash||0)-dt);
  for(const q of G.parts){q.life-=dt;q.vy+=q.grav*dt;q.x+=q.vx*dt;q.y+=q.vy*dt}G.parts=G.parts.filter(q=>q.life>0);if(G.parts.length>900)G.parts.splice(0,G.parts.length-900);
  for(const tx of G.texts){tx.life-=dt;tx.y-=26*dt}G.texts=G.texts.filter(t=>t.life>0);
  G.shake=Math.max(0,(G.shake||0)-dt*40);
  if(G.panHold>0)G.panHold-=dt;else{const c=G.cur||G.me;let tx=c?c.x:cam.x,ty=c?c.y-120:cam.y;if(G.proj.length){tx=G.proj[0].x;ty=G.proj[0].y}
    camFollow(dt,tx,ty)}
  clampCam();
  const now=performance.now();if(Math.floor(now/250)!==Math.floor((now-dt*1000)/250))updateHud();
};
window.onlineFire=function(ang,pow,w){if(!G||G.state!=='aim'||G.cur!==G.me)return;const me2=G.me;
  if(!haveAmmo(me2,w))w='basic';const warp=G.warp;if(warp)w='basic';
  let w2=null;useAmmo(me2,w);if(G.double&&!warp){w2=haveAmmo(me2,w)?w:'basic';useAmmo(me2,w2)}
  if(G.weapon!=='basic'&&!haveAmmo(me2,G.weapon))G.weapon='basic';
  me2.angle=ang;me2.lastPow=pow;G.ghost=null;G.state='sent';
  send({t:'b_fire',a:+ang.toFixed(4),pw:pow,w,x:+me2.x.toFixed(1),y:+me2.y.toFixed(1),dbl:!!w2,w2:w2||undefined,warp:!!warp});updateHud()};
window.onlineItem=function(k){const t=G.me;
  if(ITEMS[k].heal){if(G.repairUsed){toast('수리는 한 턴에 한 번만 할 수 있어요');return}if(t.hp>=t.hpMax){toast('체력이 가득해요');return}}
  if((k==='shield'||k==='rainbow')&&(t.shield||t.rainbow>0)){toast('방어막은 겹쳐 쓸 수 없어요');return}
  send({t:'b_item',k})};
function onItemRes(m){if(!G||!G.online)return;const t=G.tanks[m.i];if(!t)return;const mine=m.i===BT.myI;
  if(!m.ok){if(mine)toast('지금은 쓸 수 없어요');return}
  const v=m.tank;t.hp=v.hp;t.shield=v.shield;t.rainbow=v.rainbow;t.chute=v.chute;if(v.spider&&!t.spider){t.spider=true;t.detachT=0}
  const k=m.k,I=ITEMS[k]||{name:k};
  if(mine){D.items[k]=Math.max(0,(D.items[k]||0)-1);saveNow();
    if(I.heal){G.repairUsed=true;addText(t.x,t.y-50,`+${I.heal} 수리`,'#7dffb1',1.2,18)}
    else if(k==='scope'){G.scope=true;addText(t.x,t.y-50,'조준경!','#fff',1,16)}
    else if(k==='double'){G.double=true;addText(t.x,t.y-50,'두 번 쏘기 준비!','#fff',1,16)}
    else if(k==='warp'){G.warp=true;addText(t.x,t.y-50,'이동 포탄 장전!','#c9a6ff',1.2,16)}
    else if(k==='rope'){G.ropeArm=true;addText(t.x,t.y-50,'🕸 거미줄 준비! 조준해서 놓으면 발사','#fff',1.6,16)}
    else addText(t.x,t.y-50,I.name+'!','#8ff',1.2,16)}
  else addText(t.x,t.y-50,`${I.name}!`,'#fff',1.2,15);
  updateHud()}

/* ---- 라운드 · 경기 끝 ---- */
function onRoundEnd(m){if(!G||!G.online)return;finishPlay();G.state='over';aim=null;closeTray();
  const gold=m.gold[BT.myI]||{};G.roundGold=gold;G.roundGoldTotal=Object.values(gold).reduce((a,b)=>a+b,0);
  if(BT.eng)D.lockGold=(D.lockGold||0)+G.roundGoldTotal;else D.gold+=G.roundGoldTotal;G.matchGold+=G.roundGoldTotal;saveNow();sendLoadout();
  m.points.forEach((pt,i)=>{if(G.players[i])G.players[i].points=pt});G.teamWins=m.teamWins.slice();
  m.ranks.forEach(r=>{const t=G.tanks[r.i];t.rank=r.rank;t.roundKills=r.kills});
  const my=G.me.rank,n=G.tanks.length;$('#hud').classList.add('hidden');
  $('#rdTitle').textContent=`라운드 ${m.round} / ${m.total} 결과`+(m.why==='time'?' (시간 종료)':'');
  $('#rdRank').textContent=G.teamMode?(G.me.team===m.winTeam?'승리!':'패배'):my+'등';
  $('#rdSub').innerHTML=`처치 ${G.me.roundKills} · 받은 골드 <span class="goldtag">${G.roundGoldTotal}G</span><br>지금 골드 <span class="goldtag" id="rdGoldNow">${D.gold}G</span>`;
  let html='<tr><th>골드</th><th class="n"></th></tr>';for(const k in gold)html+=`<tr><td>${k}</td><td class="n goldtag">+${gold[k]}G</td></tr>`;
  html+='<tr><th>순위</th><th class="n">점수</th></tr>';
  if(G.teamMode){html+=`<tr><td>${TEAMNAME[m.winTeam]} 승리</td><td class="n">${TEAMNAME[0]} ${G.teamWins[0]} : ${G.teamWins[1]} ${TEAMNAME[1]}</td></tr>`;G.tanks.forEach(t=>html+=`<tr><td class="${t===G.me?'me':''}">[${TEAMNAME[t.team]}] ${esc(t.name)}${t.alive?'':' (격파)'}</td><td class="n">처치 ${t.roundKills}</td></tr>`)}
  else G.tanks.slice().sort((a,b)=>a.rank-b.rank).forEach(t=>html+=`<tr><td class="${t===G.me?'me':''}">${t.rank}. ${esc(t.name)}</td><td class="n">+${n-t.rank}점 (합계 ${t.p.points})</td></tr>`);
  $('#rdTable').innerHTML=html;
  const db=$('#rdDouble');db.disabled=G.roundGoldTotal<=0;db.textContent=`📝 2문제 맞히고 보상 2배 (+${G.roundGoldTotal}G)`;db.classList.toggle('hidden',!!BT.eng);
  if(BT.eng)$('#rdSub').innerHTML+=`<br>🔒 영단어 버전: 보상은 보관 중 (모두 <span class="goldtag">${D.lockGold}G</span>) — 경기가 끝나면 영단어 ${ENG_CLAIM}문제를 맞혀 받아요`;
  const nx=$('#rdNext');nx.disabled=false;nx.textContent=m.round>=m.total?'최종 결과 보기 ▶':'다음 라운드 준비 ▶';
  BT.roundEndAt=Date.now();showScreen('#sRound');
}
function onMatchEnd(m){if(!G||!G.online)return;G.state='over';if(typeof QZ!=='undefined'&&QZ)closeQuiz();
  const st=m.standings;const mine=st.findIndex(s=>s.uid===ON.you.id);let my=mine+1;const n=st.length;
  let honor=my===1?30:my===2?12:my===3?4:0;if(my===n&&n>1)honor=-8;
  const myTeam=G.me.team;if(G.teamMode){const w=m.teamWins[0]===m.teamWins[1]?-1:(m.teamWins[0]>m.teamWins[1]?0:1);my=w===myTeam?1:2;honor=w===myTeam?25:w===-1?8:-5}
  D.honor=Math.max(0,D.honor+honor);if(D.stats.beat===undefined)D.stats.beat=D.stats.wins;
  const w0=m.teamWins[0]===m.teamWins[1];const beat=G.teamMode?(w0?0.5:(my===1?1:0)):(n>1?(n-my)/(n-1):0);
  D.stats.games++;if(my===1)D.stats.wins++;D.stats.beat+=beat;D.stats.kills+=(st[mine]||{}).kills||0;saveNow();
  const RT=(m.ratings||{})[ON.you.id];const before=RT?RT.before:ON.you.tier||{name:'첫 판 전',color:'#9aa3ad',r:0},after=RT?RT.after:before;if(RT)ON.you.tier=after;
  $('#fnRank').textContent=G.teamMode?(m.teamWins[0]===m.teamWins[1]?'무승부':(my===1?'팀 승리!':'팀 패배')):my+'등';
  const chg=after.name!==before.name;const up=(after.tier||0)*4+(after.div||0)>(before.tier||0)*4+(before.div||0);
  $('#fnSub').innerHTML=`티어 ${tierBadge(after)}`+(chg?` (${before.name} → ${after.name})`:'')+`<br>최종 점수 ${before.r} → <b>${after.r}</b> (${RT&&RT.d>=0?'+':''}${RT?RT.d:0}) = 승률 점수 ${after.winPt} (승률 ${after.wr}% × 배점 ${after.weight}) + 플레이 점수 ${after.playPt}`+(after.rank?`<br>전체 ${after.of}명 중 ${after.rank}등 (상위 ${after.top}%)`:'')+`<br>이번 경기 골드 <span class="goldtag">${G.matchGold}G</span>`+(chg?(before.name==='첫 판 전'?`<br><span class="badge">첫 티어! ${after.name}</span>`:`<br><span class="badge">${up?'티어 상승!':'티어 하락…'} ${after.name}</span>`):'');
  let html='<tr><th>순위</th><th class="n">점수</th><th class="n">처치</th><th class="n">준 피해</th></tr>';
  st.forEach((p,i)=>html+=`<tr><td class="${p.uid===ON.you.id?'me':''}">${i+1}. ${G.teamMode?(p.team===0?'🔵 ':'🔴 '):''}${esc(p.name)}${p.ai&&p.uid?' (컴퓨터가 대신)':''}</td><td class="n">${p.points}</td><td class="n">${p.kills}</td><td class="n">${p.dmg}</td></tr>`);
  $('#fnTable').innerHTML=html;$('#hud').classList.add('hidden');showScreen('#sFinal');$('#fnLobby').textContent='방으로 돌아가기';if(BT.eng&&D.lockGold>0){$('#fnSub').innerHTML+=`<br>🔒 보관 중인 보상 <span class="goldtag">${D.lockGold}G</span> — 영단어 ${ENG_CLAIM}문제를 맞히면 받아요`;updClaim();setTimeout(claimLocked,900)}
}
function backToRoom(){G=null;document.body.classList.remove('battle');$('#hud').classList.add('hidden');$('#fnLobby').textContent='로비로';if(ON.room){showRoom();renderRoom()}else showOnLobby()}
function onSync(m){if(!m.info)return;onRound(m.info);if(m.tw)G.twisters=m.tw;if(m.env)G.env=m.env;
  for(const o of m.ops){if(o[0]===2)fillRectT(o[1],o[2],o[3],o[4]);else if(o[0]===3)clearRectT(o[1],o[2],o[3],o[4]);else if(o[0])addDirt(o[1],o[2],o[3]);else carve(o[1],o[2],o[3])}
  if(m.state==='aim'&&m.turn>=0){onTurn({i:m.turn,wind:m.wind,ms:m.ms,cycle:G.cycle,extra:null})}
  addText(G.me.x,G.me.y-130,'다시 연결됐어요!','#7dffb1',2,18)}

// 혼자 하기 버튼들을 온라인일 때만 다르게
const _rdNext=$('#rdNext').onclick,_fnLobby=$('#fnLobby').onclick,_mnQuit=$('#mnQuit').onclick;
$('#rdNext').onclick=()=>{if(!(G&&G.online))return _rdNext();sendLoadout();send({t:'b_next'});const b=$('#rdNext');b.disabled=true;b.textContent='다른 친구를 기다려요… (25초 뒤 자동 시작)'};
$('#fnLobby').onclick=()=>{if(!(G&&G.online))return _fnLobby();backToRoom()};
$('#mnQuit').onclick=()=>{if(!(G&&G.online))return _mnQuit();$('#mMenu').classList.add('hidden');if(!confirmQuit())return;send({t:'leave'});ON.room=null;G=null;document.body.classList.remove('battle');$('#hud').classList.add('hidden');showOnLobby()};
function confirmQuit(){return window.__gtNoConfirm||window.confirm('대전에서 나갈까요? 내 탱크는 컴퓨터가 대신 움직여요.')}
$('#orStart').onclick=()=>{if(ON.room&&ON.room.data==='eng'&&D.gold<ENG_FEE){needFee();return}sendLoadout();send({t:'start'})};
$('#orReady').onclick=()=>{const m=ON.room&&ON.room.slots.find(s=>s.uid===ON.you.id);if(!(m&&m.ready)&&ON.room&&ON.room.data==='eng'&&D.gold<ENG_FEE){needFee();return}sendLoadout();send({t:'ready',v:!(m&&m.ready)})};

window.__onBattle=function(m){switch(m.t){
  case 'b_round':onRound(m.info);break;
  case 'b_turn':onTurn(m);break;
  case 'b_env':onEnv(m);break;
  case 'b_pos':if(G&&G.online){const t=G.tanks[m.i];if(t&&t!==G.me){t.tx=m.x;t.ty=m.y;t.angle=m.a;t.rot=m.r}}break;
  case 'b_aim':if(G&&G.online){const t=G.tanks[m.i];BT.aiAim={i:m.i,from:t.angle,to:m.a,pw:m.pw,t:0}}break;
  case 'b_shot':onShot(m);break;
  case 'b_ev':if(G&&G.online)m.ev.forEach(applyEv);break;
  case 'b_item':onItemRes(m);break;
  case 'b_sys':if(G&&G.online)toast(m.text,2200);break;
  case 'b_ai':if(G&&G.online&&G.tanks[m.i]){G.tanks[m.i].isAI=true;G.tanks[m.i].p.isAI=true}break;
  case 'b_round_end':onRoundEnd(m);break;
  case 'b_match_end':onMatchEnd(m);break;
  case 'b_sync':onSync(m);break;
}};
function showBoard(m){let html=`<div class="on-board"><div class="row" style="justify-content:space-between"><b>🏆 실시간 순위표</b><button class="chip" id="obClose">닫기</button></div>
  <div class="sub">최종 점수 = 승률 점수(승률 × 배점) + 플레이 점수(판 수 × 5). 배점은 1~9판 1,000 · 10~99판 2,000 · 100판 이상 4,000.<br>이 점수 순위로 티어가 정해져요: 상위 4% 마스터 · 8% 다이아몬드 · 13% 플래티넘 · 20% 골드 · 25% 실버 · 20% 브론즈 · 하위 10% 아이언.</div><table class="tbl"><tr><th>순위</th><th>티어</th><th>이름</th><th class="n">점수</th><th class="n">승률</th><th class="n">판</th></tr>`;
  m.board.forEach(p=>html+=`<tr><td>${p.rank}등</td><td>${tierBadge(p)}</td><td class="${p.player===me?'me':''}">${esc(p.player)}</td><td class="n">${p.r}</td><td class="n">${p.wr}%</td><td class="n">${p.games}</td></tr>`);
  if(!m.board.length)html+='<tr><td colspan="6">아직 대전을 한 사람이 없어요.</td></tr>';
  html+='</table></div>';let d=$('#onBoardWrap');if(!d){d=document.createElement('div');d.id='onBoardWrap';document.body.appendChild(d)}d.innerHTML=html;d.classList.remove('hidden');$('#obClose').onclick=()=>d.classList.add('hidden')}
$('#olRank').style.cursor='pointer';$('#olRank').onclick=()=>send({t:'rank'});
window.__gtOnline={BT,ON};
})();
