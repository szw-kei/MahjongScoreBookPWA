const KEY="mahjongScoreBookPWA.v7";
const LEGACY_KEY="mahjongScoreBookPWA.v6";
const defaultState={
  players:["","","",""],playerCount:4,companyMode:false,rate:50,
  currentMatches:[],history:[],currentView:"home",selectedHistoryId:null,selectedPerson:null
};
let state=loadState(),calcContext=null,calcText="0",activeNameInput=null,editHistoryId=null;

function clone(x){return JSON.parse(JSON.stringify(x))}
function localDateString(d=new Date()){return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`}
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function formatNumber(n){const x=Number(n)||0;return Number.isInteger(x)?String(x):x.toFixed(1).replace(/\.0$/,"")}
function formatMoney(n){const x=Number(n)||0;return Number.isInteger(x)?String(x):x.toFixed(2).replace(/\.?0+$/,"")}
function formatUma(n){const x=Number(n)||0;if(x>0)return `○${formatNumber(x)}`;if(x<0)return `×${formatNumber(Math.abs(x))}`;return "0"}
function colorClass(n){return Number(n)>0?"uma-positive":Number(n)<0?"uma-negative":""}

function ensureRow(row,n,company){
  row.scores=Array.from({length:n},(_,i)=>row.scores?.[i]??"");
  row.uma=Array.from({length:n},(_,i)=>company?(row.uma?.[i]??""):0);
}
function normalizeState(s){
  const o={...clone(defaultState),...s};
  o.players=Array.isArray(o.players)?o.players.slice(0,4):clone(defaultState.players);
  while(o.players.length<4)o.players.push("");
  o.playerCount=o.playerCount===3?3:4;
  o.companyMode=o.playerCount===4&&!!o.companyMode;
  o.rate=Number.isFinite(Number(o.rate))?Number(o.rate):50;
  o.currentMatches=Array.isArray(o.currentMatches)?o.currentMatches:[];
  o.history=Array.isArray(o.history)?o.history:[];
  o.currentMatches.forEach(r=>ensureRow(r,o.playerCount,o.companyMode));
  o.history.forEach(h=>{
    h.id=h.id||crypto.randomUUID();h.date=h.date||localDateString();
    h.playerCount=h.playerCount===3?3:4;
    h.playerNames=Array.isArray(h.playerNames)?h.playerNames.slice(0,h.playerCount):[];
    h.matches=Array.isArray(h.matches)?h.matches:[];
    h.matches.forEach(r=>{
      r.scores=Array.from({length:h.playerCount},(_,i)=>Number(r.scores?.[i])||0);
      r.uma=Array.from({length:h.playerCount},(_,i)=>Number(r.uma?.[i])||0);
    });
    h.income=Array.isArray(h.income) ? h.income.slice(0,h.playerCount).map(v=>Number.isFinite(Number(v))?Number(v):null) : null;
  });
  return o;
}
function migrateLegacy(raw){
  const o={...clone(defaultState),players:raw.players||clone(defaultState.players),playerCount:raw.playerCount||4,companyMode:!!raw.companyMode,rate:Number(raw.rate)||50};
  o.currentMatches=(raw.matches||[]).map(r=>({scores:r.scores||[],uma:r.uma||Array(o.playerCount).fill("")}));
  return normalizeState(o);
}
function loadState(){
  try{const v7=JSON.parse(localStorage.getItem(KEY)||"null");if(v7)return normalizeState(v7);
      const old=JSON.parse(localStorage.getItem(LEGACY_KEY)||"null");if(old)return migrateLegacy(old);}
  catch(e){console.error(e)}
  return clone(defaultState);
}
function save(){localStorage.setItem(KEY,JSON.stringify(state))}
function totalsForRows(rows,company){
  const n=state.playerCount,scores=Array(n).fill(0),umas=Array(n).fill(0);
  rows.forEach(r=>{ensureRow(r,n,company);r.scores.forEach((v,i)=>scores[i]+=Number(v)||0);r.uma.forEach((v,i)=>umas[i]+=Number(v)||0)});
  const total=scores.map((v,i)=>company?v+umas[i]*5:v),income=total.map(v=>v*state.rate);
  return {scores,umas,total,income};
}

function adjusted(values){
  const nums=values.map(v=>v===""||v==null?null:Number(v));
  const missing=nums.filter(v=>v===null).length;
  if(missing===1){
    const sum=nums.reduce((a,v)=>a+(v??0),0);
    return nums.map(v=>v===null?-sum:v);
  }
  if(missing===0){
    const sum=nums.reduce((a,v)=>a+v,0);
    if(Math.abs(sum)>1e-9){
      const max=Math.max(...nums),idx=nums.indexOf(max);
      nums[idx]-=sum;
    }
  }
  return nums;
}
function autoFill(mi,kind,pi){
  const row=state.currentMatches[mi],blanks=row[kind].map((v,i)=>String(v).trim()===""?i:null).filter(i=>i!==null);
  if(blanks.length!==1||blanks[0]!==pi)return false;
  const fixed=adjusted(row[kind]);row[kind]=fixed.map(v=>v==null?"":v);save();render();return true;
}
function openCalc(mi,pi,kind){
  const raw=state.currentMatches[mi][kind][pi];
  calcContext={mi,pi,kind};calcText=raw===""?"0":String(raw);
  document.getElementById("calcValue").textContent=calcText;
  document.getElementById("calculatorDialog").showModal();
}
function closeCalc(commit=true){
  if(!calcContext)return;
  if(commit){
    const {mi,pi,kind}=calcContext,row=state.currentMatches[mi];
    let raw=calcText;
    if(raw==="-"||raw==="-0")raw=raw==="-0"?"0":"";
    row[kind][pi]=raw===""?"":Number(raw);
    row[kind]=adjusted(row[kind]).map(v=>v==null?"":v);
    save();render();
  }
  calcContext=null;document.getElementById("calculatorDialog").close();
}
function setPlayerCount(n){
  state.playerCount=n;if(n===3)state.companyMode=false;
  state.players=state.players.slice(0,n);while(state.players.length<n)state.players.push("");
  state.currentMatches.forEach(r=>ensureRow(r,n,state.companyMode));save();render();
}
function setCompany(v){
  state.companyMode=state.playerCount===4&&!!v;
  state.currentMatches.forEach(r=>{ensureRow(r,state.playerCount,state.companyMode);
    if(state.companyMode && r.uma.every(v=>Number(v)===0))r.uma=Array(state.playerCount).fill("");
    if(!state.companyMode)r.uma=Array(state.playerCount).fill(0);
  });
  save();render();
}
function addMatch(){state.currentMatches.push({scores:Array(state.playerCount).fill(""),uma:state.companyMode?Array(state.playerCount).fill(""):Array(state.playerCount).fill(0)});save();render()}
function finishGame(){
  if(!state.currentMatches.length)return;
  const n=state.playerCount;
  const valid=state.currentMatches.every(r=>{
    ensureRow(r,n,state.companyMode);
    const s=r.scores.every(v=>Number.isFinite(Number(v)))&&Math.abs(r.scores.reduce((a,v)=>a+(Number(v)||0),0))<1e-9;
    const u=!state.companyMode|| (r.uma.every(v=>Number.isFinite(Number(v)))&&Math.abs(r.uma.reduce((a,v)=>a+(Number(v)||0),0))<1e-9);
    return s&&u;
  });
  if(!valid){alert("未入力または合計が0でない半荘があります。すべて入力してください。");return}
  const savedMatches=state.currentMatches.map(r=>({
    scores:r.scores.map(Number),
    uma:state.companyMode?r.uma.map(Number):r.uma.map(Number)
  }));
  const savedTotals=totalsForRows(savedMatches,state.companyMode);
  const item={
    id:crypto.randomUUID(),
    date:localDateString(),
    playerCount:n,
    playerNames:state.players.slice(0,n),
    matches:savedMatches,
    income:savedTotals.income.map(Number)
  };
  state.history.unshift(item);state.currentMatches=[];state.currentView="home";save();render();
}
function resetParticipants(){
  if(!confirm("現在の参加者名を入力欄から消します。過去の対局履歴や参加者候補は削除しません。よろしいですか？"))return;
  state.players=["","","",""];
  activeNameInput=null;
  save();render();
}
function resetAll(){
  if(!confirm("現在の対局、過去の対局、参加者名をすべて削除します。よろしいですか？"))return;
  state=clone(defaultState);save();render();document.getElementById("settingsDialog").close();
}
function discardCurrentGame(){
  if(!state.currentMatches.length){state.currentView="home";save();render();return}
  if(!confirm("現在の対局を保存せず終了します。入力中の内容は失われます。よろしいですか？"))return;
  state.currentMatches=[];
  state.currentView="home";
  activeNameInput=null;
  save();render();
}
function editHistory(id){
  const h=state.history.find(x=>x.id===id);
  if(!h)return;
  state.playerCount=h.playerCount;
  state.players=h.playerNames.slice();
  while(state.players.length<4)state.players.push("");
  state.currentMatches=h.matches.map(r=>({
    scores:r.scores.map(Number),
    uma:r.uma.map(Number)
  }));
  editHistoryId=id;
  state.currentView="game";
  activeNameInput=null;
  save();render();
}
function saveEditedHistory(){
  if(!editHistoryId){
    finishGame();
    return;
  }
  const h=state.history.find(x=>x.id===editHistoryId);
  if(!h)return;
  const n=state.playerCount;
  const valid=state.currentMatches.length>0 && state.currentMatches.every(r=>{
    ensureRow(r,n,state.companyMode);
    const scoreOK=r.scores.every(v=>Number.isFinite(Number(v))) &&
      Math.abs(r.scores.reduce((a,v)=>a+(Number(v)||0),0))<1e-9;
    const umaOK=r.uma.every(v=>Number.isFinite(Number(v))) &&
      Math.abs(r.uma.reduce((a,v)=>a+(Number(v)||0),0))<1e-9;
    return scoreOK && umaOK;
  });
  if(!valid){
    alert("未入力または合計が0でない半荘があります。すべて確認してください。");
    return;
  }
  const savedMatches=state.currentMatches.map(r=>({
    scores:r.scores.map(Number),
    uma:r.uma.map(Number)
  }));
  const savedTotals=totalsForRows(savedMatches,h.playerCount===4);
  h.playerCount=n;
  h.playerNames=state.players.slice(0,n);
  h.matches=savedMatches;
  // Do not persist company mode or multiplier.
  h.income=savedTotals.income.map(Number);
  // Recalculate derived history fields.
  normalizeHistoryItemForEdit(h);
  state.currentMatches=[];
  state.currentView="history";
  state.selectedHistoryId=h.id;
  editHistoryId=null;
  activeNameInput=null;
  save();render();
}
function normalizeHistoryItemForEdit(h){
  h.playerCount=h.playerCount===3?3:4;
  h.playerNames=(h.playerNames||[]).slice(0,h.playerCount);
  h.matches=(h.matches||[]).map(r=>({
    scores:Array.from({length:h.playerCount},(_,i)=>Number(r.scores?.[i])||0),
    uma:Array.from({length:h.playerCount},(_,i)=>Number(r.uma?.[i])||0)
  }));
  const scores=Array(h.playerCount).fill(0);
  const umas=Array(h.playerCount).fill(0);
  h.matches.forEach(r=>{
    r.scores.forEach((v,i)=>scores[i]+=Number(v)||0);
    r.uma.forEach((v,i)=>umas[i]+=Number(v)||0);
  });
  h.income=Array.isArray(h.income)?h.income.slice(0,h.playerCount):null;
}
function deleteHistory(id){
  if(!confirm("この対局記録を削除しますか？"))return;
  state.history=state.history.filter(h=>h.id!==id);state.selectedHistoryId=null;state.currentView="history";save();render();
}
function startNew(){
  editHistoryId=null;
  activeNameInput=null;
  const names=state.players.slice(0,state.playerCount).map(x=>x.trim());
  if(names.some(x=>!x)){alert("参加者名を入力してください。");return}
  state.players=names;state.currentMatches=[];addMatch();state.currentView="game";
}
function allParticipantNames(){
  const seen=new Set(),out=[];
  for(const h of state.history){
    for(const name of (h.playerNames||[])){
      const clean=String(name||"").trim();
      if(clean && !seen.has(clean)){seen.add(clean);out.push(clean);}
    }
  }
  return out;
}
function participantSuggestions(query,index){
  const q=String(query||"").trim().toLowerCase();
  const current=new Set(state.players.map((n,i)=>i===index?"":String(n||"").trim()).filter(Boolean));
  const names=allParticipantNames().filter(name=>!current.has(name));
  if(!q)return names.slice(0,8);
  return names.filter(name=>name.toLowerCase().includes(q)).slice(0,8);
}
function recentGroupSuggestions(){
  const groups=[];
  const seen=new Set();
  for(const h of state.history){
    if(!Array.isArray(h.playerNames)||h.playerNames.length<2)continue;
    const names=h.playerNames.map(n=>String(n||"").trim()).filter(Boolean);
    if(names.length<2)continue;
    const key=names.join("\\u0001");
    if(seen.has(key))continue;
    seen.add(key);
    groups.push(names);
    if(groups.length>=5)break;
  }
  return groups;
}
function renderNameSuggestions(index,query){
  const list=participantSuggestions(query,index);
  if(!list.length)return "";
  return `<div class="name-suggestions">
    ${list.map(name=>`<button type="button" class="name-suggestion" data-suggestion-index="${index}" data-suggestion-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join("")}
  </div>`;
}
function updateSuggestionPopup(input){
  const wrap=input.closest(".name-field-wrap");
  if(!wrap)return;
  const index=Number(input.dataset.index);
  const holder=wrap.querySelector(".name-suggestions-holder");
  if(holder)holder.innerHTML=renderNameSuggestions(index,input.value);
  wrap.querySelectorAll(".name-suggestion").forEach(b=>b.onclick=()=>{
    applyParticipantSuggestion(Number(b.dataset.suggestionIndex),b.dataset.suggestionName);
  });
}
function applyParticipantSuggestion(index,name){
  state.players[index]=name;
  activeNameInput=null;
  save();render();
}
function applyGroupSuggestion(names){
  const n=state.playerCount;
  state.players=names.slice(0,n);
  while(state.players.length<n)state.players.push("");
  activeNameInput=null;
  save();render();
}
function people(){
  const set=new Set();state.history.forEach(h=>h.playerNames.forEach(n=>{if(n)set.add(n)}));return [...set].sort((a,b)=>a.localeCompare(b,"ja"));
}
function personStats(name){
  const gs={3:initStats(3),4:initStats(4)};
  state.history.forEach(h=>{
    const pi=h.playerNames.indexOf(name);if(pi<0)return;
    const g=gs[h.playerCount];g.games++;g.hands+=h.matches.length;
    h.matches.forEach(r=>{
      const scores=r.scores.map(Number),order=[...scores.keys()].sort((a,b)=>scores[b]-scores[a]),rank=order.indexOf(pi)+1;
      if(rank>=1&&rank<=4)g.ranks[rank]++;
      g.score+=Number(r.scores[pi])||0;g.uma+=Number(r.uma[pi])||0;g.rankSum+=rank;g.handCount++;
    });
    g.total=h.playerCount===4?g.score+g.uma*5:g.score;
    if(Array.isArray(h.income) && Number.isFinite(Number(h.income[pi]))){
      g.income+=Number(h.income[pi])||0;
      g.incomeRecords++;
    }
    g.avg=g.handCount?g.rankSum/g.handCount:null;g.firstRate=g.handCount?g.ranks[1]/g.handCount*100:null;
  });return gs;
}
function initStats(n){return{games:0,hands:0,handCount:0,ranks:{1:0,2:0,3:0,4:0},score:0,uma:0,total:0,rankSum:0,avg:null,firstRate:null,income:0,incomeRecords:0}}

function navTabs(active){
  return `<div class="nav-tabs"><button class="tab-btn ${active==="home"?"active":""}" data-view="home">新しい対局</button><button class="tab-btn ${active==="history"?"active":""}" data-view="history">過去の対局</button><button class="tab-btn ${active==="people"?"active":""}" data-view="people">参加者成績</button></div>`;
}
function renderHome(){
  return `<section class="card">${navTabs("home")}<h2 class="section-title">新しい対局</h2><div class="form-grid">
    <div><div class="small-note">対局人数</div><div class="segmented"><button class="${state.playerCount===3?"active":""}" data-count="3">3人打ち</button><button class="${state.playerCount===4?"active":""}" data-count="4">4人打ち</button></div></div>
    ${state.playerCount===4?`<label class="setting-row" style="padding:8px 0;border:0"><span>会社モード</span><input id="newCompanyMode" type="checkbox" ${state.companyMode?"checked":""}></label>`:""}
    <div>
      <div class="small-note">参加者名</div>
      <div class="name-grid">
        ${state.players.slice(0,state.playerCount).map((n,i)=>`<div class="name-field-wrap">
          <input class="name-input" data-index="${i}" value="${escapeHtml(n)}" placeholder="${i+1}人目" autocomplete="off">
          <div class="name-suggestions-holder">${activeNameInput===i?renderNameSuggestions(i,n):""}</div>
        </div>`).join("")}
      </div>
      ${recentGroupSuggestions().length?`<div class="recent-group-wrap"><div class="small-note">過去の組み合わせ</div><div class="recent-group-list">${recentGroupSuggestions().slice(0,3).map((names,i)=>`<button type="button" class="recent-group-btn" data-group-index="${i}">${escapeHtml(names.join("・"))}</button>`).join("")}</div></div>`:""}
    </div>
    <button id="startBtn" class="primary-btn">対局を開始</button>
  </div></section>`;
}
function renderGame(){
  const n=state.playerCount,names=state.players.slice(0,n).map((x,i)=>x||`${i+1}人目`),t=totalsForRows(state.currentMatches,state.companyMode);
  const thead=`<thead><tr><th class="row-label">半荘</th>${names.map(name=>`<th><span class="player-head-name">${escapeHtml(name)}</span>${state.companyMode?`<span class="player-head-sub"><span>ウマ</span><span>スコア</span></span>`:""}</th>`).join("")}</tr></thead>`;
  const body=state.currentMatches.map((r,mi)=>`<tr><th class="row-label">${mi+1}</th>${names.map((_,pi)=>state.companyMode?`<td><div class="company-row"><button class="cell-btn ${colorClass(r.uma[pi])}" data-mi="${mi}" data-pi="${pi}" data-kind="uma">${r.uma[pi]===""?"":formatUma(r.uma[pi])}</button><button class="cell-btn ${colorClass(r.scores[pi])}" data-mi="${mi}" data-pi="${pi}" data-kind="scores">${r.scores[pi]===""?"":formatNumber(r.scores[pi])}</button></div></td>`:`<td><button class="cell-btn ${colorClass(r.scores[pi])}" data-mi="${mi}" data-pi="${pi}" data-kind="scores">${r.scores[pi]===""?"":formatNumber(r.scores[pi])}</button></td>`).join("")}</tr>`).join("");
  return `<section class="card"><div class="detail-head"><button class="back-btn" id="backHome">‹ 保存せず終了</button><div><strong>対局成績</strong><div class="muted">${state.companyMode?"4人打ち・会社モード":`${n}人打ち`}</div></div></div>
    <div class="table-wrap"><table class="score-table">${thead}<tbody>${body}</tbody></table></div>
    <button id="addMatchBtn" class="secondary-btn add-row">＋ 半荘を追加</button>
    ${editHistoryId?`<button id="saveEditBtn" class="primary-btn add-row">編集内容を保存</button>`:`<button id="finishGameBtn" class="primary-btn add-row">対局を記録する</button>`}
    <div class="small-note">${editHistoryId?"過去の対局を編集中です。":"1人分だけ空欄にすると、そのセルをタップして自動計算します。"} 入力済みの修正でも合計0に調整します。</div></section>
    <div class="totals-sticky"><div class="totals-inner">${renderCurrentTotals(t,names)}</div></div>`;
}
function renderCurrentTotals(t,names){
  if(!state.companyMode)return `<div class="total-row simple"><span class="label">合計</span>${t.total.map(v=>`<span>${formatNumber(v)}</span>`).join("")}</div><div class="total-row simple total-income"><span class="label">収支</span>${t.income.map(v=>`<span>${formatMoney(v)}</span>`).join("")}</div><div class="summary-note">倍率 ${formatNumber(state.rate)}倍</div>`;
  return `<div class="total-row company"><span class="label">集計</span>${names.map((_,i)=>`<span class="total-pair"><span class="${colorClass(t.umas[i])}">${formatUma(t.umas[i])}</span><span>${formatNumber(t.scores[i])}</span></span>`).join("")}</div>
    <div class="total-row company"><span class="label">合計</span>${names.map((_,i)=>`<span>${formatNumber(t.total[i])}</span>`).join("")}</div>
    <div class="total-row company total-income"><span class="label">収支</span>${names.map((_,i)=>`<span>${formatMoney(t.income[i])}</span>`).join("")}</div>
    <div class="summary-note">各人：ウマ｜スコア　／ 合計=ウマ×5＋スコア　／ 倍率 ${formatNumber(state.rate)}倍</div>`;
}
function renderHistory(){
  return `<section class="card">${navTabs("history")}<h2 class="section-title">過去の対局</h2>${state.history.length?state.history.map(h=>`<button class="history-item" data-history-id="${h.id}"><div class="history-top"><span>${escapeHtml(h.date)}</span><span>${h.playerCount}人打ち</span></div><div class="history-bottom">${escapeHtml(h.playerNames.join("・"))}　／　${h.matches.length}半荘</div></button>`).join(""):`<div class="empty-state">まだ対局記録がありません。</div>`}</section>`;
}
function renderHistoryDetail(){
  const h=state.history.find(x=>x.id===state.selectedHistoryId);if(!h)return renderHistory();
  const names=h.playerNames;
  const rows=h.matches.map((r,mi)=>`<tr><th class="row-label">${mi+1}</th>${names.map((_,pi)=>`<td><div class="company-row"><div class="cell-btn ${colorClass(r.uma[pi])}">${formatUma(r.uma[pi])}</div><div class="cell-btn ${colorClass(r.scores[pi])}">${formatNumber(r.scores[pi])}</div></div></td>`).join("")}</tr>`).join("");
  const totals=h.playerNames.map((_,i)=>({
    uma:h.matches.reduce((s,r)=>s+(Number(r.uma[i])||0),0),
    score:h.matches.reduce((s,r)=>s+(Number(r.scores[i])||0),0),
    income:Array.isArray(h.income)&&h.income[i]!==null ? Number(h.income[i])||0 : null
  }));
  return `<section class="card"><div class="detail-head"><button class="back-btn" id="backHistory">‹ 戻る</button><div><strong>${escapeHtml(h.date)}</strong><div class="muted">${h.playerCount}人打ち・${h.matches.length}半荘</div></div></div>
    <div class="table-wrap"><table class="score-table"><thead><tr><th class="row-label">半荘</th>${names.map(n=>`<th><span class="player-head-name">${escapeHtml(n)}</span><span class="player-head-sub"><span>ウマ</span><span>スコア</span></span></th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="history-player-grid">${names.map((n,i)=>`<div class="history-player-card"><h4>${escapeHtml(n)}</h4><div class="stat-grid"><span>ウマ</span><strong class="${colorClass(totals[i].uma)}">${formatUma(totals[i].uma)}</strong><span>スコア</span><strong>${formatNumber(totals[i].score)}</strong><span>合計</span><strong>${formatNumber(totals[i].score+totals[i].uma*5)}</strong><span>収支</span><strong>${totals[i].income===null?"—":formatMoney(totals[i].income)}</strong></div></div>`).join("")}</div>
    ${Array.isArray(h.income)&&h.income.some(v=>v===null)?`<div class="small-note">— は収支保存機能追加前の記録です。</div>`:""}
    <button class="primary-btn add-row" id="editHistoryBtn">この対局を編集</button>
    <button class="danger-btn" id="deleteHistoryBtn">この対局記録を削除</button></section>`;
}
function renderPeople(){
  const ps=people();return `<section class="card">${navTabs("people")}<h2 class="section-title">参加者成績</h2>${ps.length?ps.map(n=>{const g=personStats(n);return `<button class="person-card" data-person="${escapeHtml(n)}"><h3>${escapeHtml(n)}</h3><div class="person-summary">4人打ち ${g[4].games}対局・${g[4].handCount}半荘　／　3人打ち ${g[3].games}対局・${g[3].handCount}半荘</div></button>`}).join(""):`<div class="empty-state">対局を記録すると参加者成績が表示されます。</div>`}</section>`;
}
function statsCard(label,g,n){
  if(!g.games)return `<div class="card"><h3>${label}</h3><div class="empty-state">記録なし</div></div>`;
  let rankRows="";for(let i=1;i<=n;i++)rankRows+=`<span>${i}位</span><strong>${g.ranks[i]}回</strong>`;
  const incomeText=g.incomeRecords===g.games?formatMoney(g.income):`${formatMoney(g.income)}*`;
  const incomeNote=g.incomeRecords<g.games?`<div class="small-note">* 収支保存前の旧記録は累計に含まれていません。</div>`:"";
  return `<div class="card"><h3>${label}</h3><div class="stat-grid"><span>対局数</span><strong>${g.games}</strong><span>半荘数</span><strong>${g.handCount}</strong>${rankRows}<span>平均順位</span><strong>${g.avg.toFixed(2)}</strong><span>1位率</span><strong>${g.firstRate.toFixed(1)}%</strong><span>ウマ合計</span><strong class="${colorClass(g.uma)}">${formatUma(g.uma)}</strong><span>スコア合計</span><strong>${formatNumber(g.score)}</strong><span>合計スコア</span><strong>${formatNumber(g.total)}</strong><span>収支</span><strong>${incomeText}</strong></div>${incomeNote}</div>`;
}
function renderPersonDetail(){
  const name=state.selectedPerson;
  if(!name)return renderPeople();
  const g=personStats(name);
  const g4=g[4], g3=g[3];
  const income=g4.income+g3.income;
  const hasOld=!((g4.incomeRecords===g4.games)&&(g3.incomeRecords===g3.games));

  const rankRate=(x)=>g4.handCount?`${(x/g4.handCount*100).toFixed(1)}%`:"0.0%";
  const card4=g4.games?`
    <section class="person-stat-section">
      <button class="person-section-head" data-person-section="4">
        <span>4人戦績</span><span class="chevron open">⌃</span>
      </button>
      <div class="person-section-body">
        <div class="rank-grid">
          ${[1,2,3,4].map(i=>`<div class="rank-card"><div class="rank-label">${i}着</div><div class="rank-value">${g4.ranks[i]}</div><div class="rank-unit">回</div><div class="rank-rate">${rankRate(g4.ranks[i])}</div></div>`).join("")}
        </div>
        <div class="metric-grid">
          <div class="metric-card"><span>平均順位</span><strong>${g4.avg?.toFixed(2) ?? "—"}</strong></div>
          <div class="metric-card"><span>1位率</span><strong>${g4.firstRate?.toFixed(1) ?? "0.0"}<small>%</small></strong></div>
          <div class="metric-card"><span>ウマ合計</span><strong class="${colorClass(g4.uma)}">${formatUma(g4.uma)}</strong></div>
          <div class="metric-card"><span>スコア合計</span><strong>${formatNumber(g4.score)}</strong></div>
          <div class="metric-card"><span>対局数</span><strong>${g4.games}<small>回</small></strong></div>
          <div class="metric-card"><span>半荘数</span><strong>${g4.handCount}<small>半荘</small></strong></div>
        </div>
        <div class="person-total-row"><span>合計スコア</span><strong>${formatNumber(g4.total)}</strong></div>
        <div class="person-total-row"><span>収支</span><strong>${formatMoney(g4.income)}${g4.incomeRecords<g4.games?"*":""}</strong></div>
      </div>
    </section>`:
    `<section class="person-stat-section"><div class="person-section-head static"><span>4人戦績</span><span class="chevron">⌄</span></div><div class="empty-state compact">記録なし</div></section>`;

  const card3=g3.games?`
    <section class="person-stat-section collapsed">
      <button class="person-section-head" data-person-section="3">
        <span>3人戦績</span><span class="chevron">⌄</span>
      </button>
      <div class="person-section-body hidden">
        <div class="rank-grid rank-grid-3">
          ${[1,2,3].map(i=>`<div class="rank-card"><div class="rank-label">${i}着</div><div class="rank-value">${g3.ranks[i]}</div><div class="rank-unit">回</div><div class="rank-rate">${g3.handCount?(g3.ranks[i]/g3.handCount*100).toFixed(1):"0.0"}%</div></div>`).join("")}
        </div>
        <div class="metric-grid">
          <div class="metric-card"><span>平均順位</span><strong>${g3.avg?.toFixed(2) ?? "—"}</strong></div>
          <div class="metric-card"><span>1位率</span><strong>${g3.firstRate?.toFixed(1) ?? "0.0"}<small>%</small></strong></div>
          <div class="metric-card"><span>ウマ合計</span><strong class="${colorClass(g3.uma)}">${formatUma(g3.uma)}</strong></div>
          <div class="metric-card"><span>スコア合計</span><strong>${formatNumber(g3.score)}</strong></div>
          <div class="metric-card"><span>対局数</span><strong>${g3.games}<small>回</small></strong></div>
          <div class="metric-card"><span>半荘数</span><strong>${g3.handCount}<small>半荘</small></strong></div>
        </div>
        <div class="person-total-row"><span>合計スコア</span><strong>${formatNumber(g3.total)}</strong></div>
        <div class="person-total-row"><span>収支</span><strong>${formatMoney(g3.income)}${g3.incomeRecords<g3.games?"*":""}</strong></div>
      </div>
    </section>`:
    `<section class="person-stat-section collapsed"><button class="person-section-head" data-person-section="3"><span>3人戦績</span><span class="chevron">⌄</span></button><div class="empty-state compact hidden">記録なし</div></section>`;

  return `<section class="person-page">
    <div class="person-toolbar">
      <button class="person-back" id="backPeople">‹ 戻る</button>
      <div class="user-switch"><span>ユーザ変更：</span><strong>${escapeHtml(name)}</strong></div>
      <button class="person-menu" id="personMenuBtn" aria-label="参加者変更">☷</button>
    </div>

    <section class="balance-card">
      <div class="balance-label">収支</div>
      <div class="balance-value">${income>=0?"+":""}${formatMoney(income)}</div>
      <div class="balance-unit">P</div>
    </section>

    ${card4}
    ${card3}

    <section class="card person-total-summary">
      <div class="person-summary-title">総合</div>
      <div class="person-summary-grid">
        <div><span>対局数</span><strong>${g4.games+g3.games}</strong></div>
        <div><span>半荘数</span><strong>${g4.handCount+g3.handCount}</strong></div>
        <div><span>ウマ合計</span><strong>${formatUma(g4.uma+g3.uma)}</strong></div>
        <div><span>スコア合計</span><strong>${formatNumber(g4.score+g3.score)}</strong></div>
        <div><span>合計スコア</span><strong>${formatNumber(g4.total+g3.total)}</strong></div>
        <div><span>収支</span><strong>${formatMoney(income)}${hasOld?"*":""}</strong></div>
      </div>
      ${hasOld?`<div class="small-note">* 収支保存前の旧記録は累計収支に含まれていません。</div>`:""}
    </section>

    ${hasOld?`<div class="small-note person-old-note">※ 収支保存機能追加前の対局は収支集計から除外しています。</div>`:""}
  </section>`;
}
function render(){
  let html;if(state.currentView==="game")html=renderGame();else if(state.currentView==="history"&&state.selectedHistoryId)html=renderHistoryDetail();else if(state.currentView==="history")html=renderHistory();else if(state.currentView==="people"&&state.selectedPerson)html=renderPersonDetail();else if(state.currentView==="people")html=renderPeople();else html=renderHome();
  document.getElementById("app").innerHTML=html;bind();
}
function bind(){
  document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>{activeNameInput=null;state.currentView=b.dataset.view;state.selectedHistoryId=null;state.selectedPerson=null;save();render()});
  document.querySelectorAll("[data-count]").forEach(b=>b.onclick=()=>setPlayerCount(Number(b.dataset.count)));
  document.querySelectorAll(".name-input").forEach(i=>{
    i.onfocus=()=>{
      activeNameInput=Number(i.dataset.index);
      updateSuggestionPopup(i);
    };
    i.onclick=()=>{
      activeNameInput=Number(i.dataset.index);
      updateSuggestionPopup(i);
    };
    i.oninput=()=>{
      const idx=Number(i.dataset.index);
      state.players[idx]=i.value;
      activeNameInput=idx;
      save();
      updateSuggestionPopup(i);
    };
  });
  document.querySelectorAll(".name-suggestion").forEach(b=>b.onclick=()=>{
    applyParticipantSuggestion(Number(b.dataset.suggestionIndex),b.dataset.suggestionName);
  });
  document.querySelectorAll(".recent-group-btn").forEach(b=>b.onclick=()=>{
    const groups=recentGroupSuggestions();
    const idx=Number(b.dataset.groupIndex);
    if(groups[idx])applyGroupSuggestion(groups[idx]);
  });
  const nc=document.getElementById("newCompanyMode");if(nc)nc.onchange=()=>setCompany(nc.checked);
  const start=document.getElementById("startBtn");if(start)start.onclick=startNew;
  const backHome=document.getElementById("backHome");if(backHome)backHome.onclick=()=>{if(editHistoryId){state.currentMatches=[];state.currentView="history";state.selectedHistoryId=editHistoryId;editHistoryId=null;save();render();}else discardCurrentGame();};
  document.querySelectorAll(".cell-btn[data-kind]").forEach(b=>b.onclick=()=>{const mi=Number(b.dataset.mi),pi=Number(b.dataset.pi),kind=b.dataset.kind,row=state.currentMatches[mi];const blanks=row[kind].map((v,i)=>String(v).trim()===""?i:null).filter(i=>i!==null);if(blanks.length===1&&blanks[0]===pi){autoFill(mi,kind,pi)}else openCalc(mi,pi,kind)});
  const add=document.getElementById("addMatchBtn");if(add)add.onclick=addMatch;
  const finish=document.getElementById("finishGameBtn");if(finish)finish.onclick=finishGame;
  const saveEdit=document.getElementById("saveEditBtn");if(saveEdit)saveEdit.onclick=saveEditedHistory;
  const editHistoryBtn=document.getElementById("editHistoryBtn");if(editHistoryBtn)editHistoryBtn.onclick=()=>editHistory(state.selectedHistoryId);

  document.querySelectorAll("[data-history-id]").forEach(b=>b.onclick=()=>{state.selectedHistoryId=b.dataset.historyId;state.currentView="history";save();render()});
  const bh=document.getElementById("backHistory");if(bh)bh.onclick=()=>{state.selectedHistoryId=null;render()};
  const dh=document.getElementById("deleteHistoryBtn");if(dh)dh.onclick=()=>deleteHistory(state.selectedHistoryId);
  document.querySelectorAll("[data-person]").forEach(b=>b.onclick=()=>{state.selectedPerson=b.dataset.person;state.currentView="people";save();render()});
  const bp=document.getElementById("backPeople");if(bp)bp.onclick=()=>{state.selectedPerson=null;render()};
  document.querySelectorAll("[data-person-section]").forEach(btn=>btn.onclick=()=>{
    const section=btn.closest(".person-stat-section");
    const body=section.querySelector(".person-section-body");
    const chevron=btn.querySelector(".chevron");
    if(body){
      body.classList.toggle("hidden");
      section.classList.toggle("collapsed",body.classList.contains("hidden"));
      if(chevron)chevron.textContent=body.classList.contains("hidden")?"⌄":"⌃";
    }
  });
  const personMenu=document.getElementById("personMenuBtn");
  if(personMenu)personMenu.onclick=()=>{state.selectedPerson=null;state.currentView="people";save();render();};

}
document.getElementById("settingsBtn").onclick=()=>{document.getElementById("companyModeToggle").checked=state.companyMode;document.getElementById("rateInput").value=state.rate;document.getElementById("settingsDialog").showModal()};
document.getElementById("closeSettings").onclick=()=>document.getElementById("settingsDialog").close();
document.getElementById("companyModeToggle").onchange=e=>setCompany(e.target.checked);
document.getElementById("rateInput").onchange=e=>{const v=Number(e.target.value);state.rate=Number.isFinite(v)&&v>=0?v:50;save();render()};
document.getElementById("resetParticipantsBtn").onclick=resetParticipants;
document.querySelectorAll("#calculatorDialog [data-key]").forEach(btn=>btn.onclick=()=>{
  const k=btn.dataset.key;
  if(k==="ok")return closeCalc(true);
  if(k==="clear")calcText="0";
  else if(k==="back")calcText=calcText.length>1?calcText.slice(0,-1):"0";
  else if(k==="minus"){if(calcText==="0")calcText="-0";else calcText=calcText.startsWith("-")?calcText.slice(1):"-"+calcText}
  else calcText=calcText==="0"?k:calcText==="-0"?`-${k}`:calcText+k;
  document.getElementById("calcValue").textContent=calcText;
});
document.getElementById("calculatorDialog").addEventListener("cancel",e=>{e.preventDefault();closeCalc(false)});
if("serviceWorker"in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.error));
render();
