const CONTACTS=[
{name:"Una",phone:"+62 831-2563-7801",wa:"6283125637801"},
{name:"Shion",phone:"+62 859-3373-8126",wa:"6285933738126"},
{name:"Gary",phone:"+65 9058 5717",wa:"6590585717"}
];
const {createClient}=window.supabase;
const sb=createClient(window.TN_SUPABASE_URL,window.TN_SUPABASE_ANON_KEY);
let seasons=[],currentId=null,adminSeasonId=null;
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const teamCount=s=>Array.isArray(s?.teams)?s.teams.length:0;
const MAX_TEAMS=4096;
const roundNumber=m=>{
  if(m?.roundNum)return Number(m.roundNum);
  if(m?.round==="Final")return 1;
  if(m?.round==="Semifinal")return 2;
  if(m?.round==="Quarterfinal")return 4;
  const n=String(m?.round||"").match(/(\d+)/); return n?Number(n[1]):1;
};
const roundLabel=n=>({1:"Final",2:"Semifinal",4:"Quarterfinal",8:"Round of 16",16:"Round of 32",32:"Round of 64",64:"Round of 128"}[n]||`Round of ${n*2}`);
function winner(m){if(!m||m.sa==null||m.sb==null||m.sa===m.sb)return "TBD";return Number(m.sa)>Number(m.sb)?m.a:m.b;}
function buildBracket(teams){
  const names=teams.map(t=>typeof t==='string'?t:t.name).map(x=>String(x||'').trim()).filter(Boolean);
  if(names.length<2)return [];
  let size=1;while(size<names.length)size*=2;
  if(size>MAX_TEAMS)throw new Error(`Maximum bracket size is ${MAX_TEAMS} teams.`);
  const slots=names.slice(0,size);while(slots.length<size)slots.push("BYE");
  const matches=[];let count=size/2;let prev=[];
  for(let i=0;i<size;i+=2){
    const a=slots[i]||"BYE",b=slots[i+1]||"BYE";
    prev.push({a,b,sa:a!=="BYE"&&b!=="BYE"?null:(a!=="BYE"?1:null),sb:a==="BYE"&&b!=="BYE"?1:null});
  }
  prev.forEach((m,i)=>matches.push({id:`r${count}-${i+1}`,roundNum:count,round:roundLabel(count),a:m.a,b:m.b,sa:m.sa,sb:m.sb}));
  while(count>1){
    const nextCount=count/2,next=[];
    for(let i=0;i<count;i+=2){
      const m={id:`r${nextCount}-${i/2+1}`,roundNum:nextCount,round:roundLabel(nextCount),a:winner(prev[i]),b:winner(prev[i+1]),sa:null,sb:null};
      next.push(m);matches.push(m);
    }
    prev=next;count=nextCount;
  }
  return matches;
}
function recalc(matches){
  if(!Array.isArray(matches)||!matches.length)return;
  const rounds=[...new Set(matches.map(roundNumber))].sort((a,b)=>b-a);
  for(let r=0;r<rounds.length-1;r++){
    const cur=matches.filter(m=>roundNumber(m)===rounds[r]).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    const nxt=matches.filter(m=>roundNumber(m)===rounds[r+1]).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    nxt.forEach((m,i)=>{m.a=cur[i*2]?winner(cur[i*2]):"TBD";m.b=cur[i*2+1]?winner(cur[i*2+1]):"TBD";if(m.a==="BYE")m.a="TBD";if(m.b==="BYE")m.b="TBD";m.roundNum=rounds[r+1];m.round=roundLabel(m.roundNum);});
  }
}
function shuffleArray(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[x[i],x[j]]=[x[j],x[i]];}return x;}
async function loadSeasons(){
  const {data,error}=await sb.from("seasons").select("*").order("created_at",{ascending:true});
  if(error){$("syncState").textContent="Database error";console.error(error);return;}
  seasons=data||[];
  if(!currentId&&seasons[0])currentId=seasons[0].id;
  if(currentId&&!seasons.some(s=>s.id===currentId))currentId=seasons[0]?.id||null;
  renderPublic();$("syncState").textContent="Online · realtime";
  if(!$('adminPanel').classList.contains('hidden'))renderAdmin();
}
function current(){return seasons.find(s=>s.id===currentId)||seasons[0];}
function renderPublic(){
  const s=current();
  if(!s){$("seasonSelect").innerHTML="";$("seasonTitle").textContent="No season yet";$("seasonTeams").textContent="0";$("seasonRegistration").textContent="0 / 0";$("bracketView").innerHTML='<div class="empty">No tournament season has been created yet.</div>';return;}
  $('seasonSelect').innerHTML=seasons.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.name)}</option>`).join('');
  $('seasonTitle').textContent=s.name;$('seasonStatus').textContent=s.status||'Pendaftaran';$('seasonTeams').textContent=teamCount(s);$('seasonRegistration').textContent=`${teamCount(s)} / ${s.target_teams||teamCount(s)}`;
  const pct=s.target_teams?Math.min(100,teamCount(s)/s.target_teams*100):0;$('registrationProgress').style.width=pct+'%';$('seasonDesc').textContent=s.description||'Registration and bracket updates are handled by TitikNgumpul admins.';
  const ms=JSON.parse(JSON.stringify(s.matches||[]));recalc(ms);renderBracket(ms);
}
function renderBracket(matches){
  if(!matches.length){$('bracketView').innerHTML='<div class="empty">Bracket has not been created. Admin can build it from registered teams.</div>';return;}
  const rounds=[...new Set(matches.map(roundNumber))].sort((a,b)=>b-a);
  $('bracketView').innerHTML=`<div class="bracket-track">${rounds.map((r,ri)=>{
    const rm=matches.filter(m=>roundNumber(m)===r).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));
    const gap=ri===0?18:(ri===1?112:(ri===2?300:(ri===3?676:(ri===4?1428:(ri===5?2932:(ri===6?5940:11956))))));
    return `<div class="bracket-stage stage-${ri}" style="--match-gap:${gap}px"><div class="stage-title"><span>${esc(roundLabel(r))}</span><small>${rm.length} match${rm.length===1?'':'es'}</small></div><div class="stage-matches">${rm.map((m,i)=>{
      const sa=m.sa,sb=m.sb,hasScore=sa!=null&&sb!=null;
      return `<button class="match-card ${hasScore?'has-score':''}" type="button" data-match-id="${esc(m.id)}" data-round="${r}" title="${esc('Admin: click to edit this match')}"><div class="match-line ${hasScore&&Number(sa)>Number(sb)?'win':''}"><span>${esc(m.a||'TBD')}</span><b class="score">${sa??'—'}</b></div><div class="match-line ${hasScore&&Number(sb)>Number(sa)?'win':''}"><span>${esc(m.b||'TBD')}</span><b class="score">${sb??'—'}</b></div></button>`;
    }).join('')}</div></div>`;
  }).join('')}</div>`;
}
function renderContacts(){$('contactsList').innerHTML=CONTACTS.map(c=>`<div class="contact-item"><b>${c.name}</b><a href="https://wa.me/${c.wa}" target="_blank" rel="noopener">${c.phone}</a></div>`).join('');}
async function login(){const email=$("loginEmail").value.trim(),password=$("loginPassword").value;const {error}=await sb.auth.signInWithPassword({email,password});$("loginMsg").textContent=error?error.message:"Login successful.";if(!error)showAdmin();}
async function logout(){await sb.auth.signOut();showLogin();}
async function showAdmin(){const {data:{session}}=await sb.auth.getSession();if(!session){showLogin();return;}$('loginPanel').classList.add('hidden');$('adminPanel').classList.remove('hidden');renderAdmin();}
function showLogin(){$('loginPanel').classList.remove('hidden');$('adminPanel').classList.add('hidden');}
function adminSeason(){return seasons.find(s=>s.id===adminSeasonId);}
function renderAdmin(){
  if(!seasons.length){$('seasonList').innerHTML='<div class="empty">No seasons yet.</div>';return;}
  if(!adminSeasonId)adminSeasonId=currentId||seasons[0].id;
  const opts=seasons.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join('');
  $('adminSeasonSelect').innerHTML=opts;$('adminMatchSeason').innerHTML=opts;$('adminSeasonSelect').value=adminSeasonId;$('adminMatchSeason').value=adminSeasonId;
  $('seasonList').innerHTML=seasons.map(s=>`<div class="season-admin-item"><div><b>${esc(s.name)}</b><small>${esc(s.status||'Pendaftaran')} · ${teamCount(s)} / ${s.target_teams||teamCount(s)} teams</small></div><button class="btn ghost manage" data-id="${s.id}">Edit</button></div>`).join('');
  renderTeams();renderMatches();
}
function renderTeams(){
  const s=adminSeason();if(!s){$('teamList').innerHTML='';return;}
  $('teamList').innerHTML=(s.teams||[]).map((t,i)=>`<div class="team-row"><span>#${i+1}</span><input data-team="${i}" value="${esc(t.name||t)}"><button class="danger-btn remove-team" data-i="${i}">Remove</button></div>`).join('')||'<div class="empty">No participants yet.</div>';
}
function renderMatches(){
  const s=adminSeason();if(!s){$('matchEditor').innerHTML='';return;}
  $('matchEditor').innerHTML=(s.matches||[]).map((m,i)=>`<div class="match-editor"><span class="roundname">${esc(m.round||roundLabel(roundNumber(m)))}</span><input data-i="${i}" data-k="a" value="${esc(m.a)}"><input data-i="${i}" data-k="b" value="${esc(m.b)}"><div class="score-inputs"><input data-i="${i}" data-k="sa" type="number" min="0" value="${m.sa??''}" placeholder="0"><input data-i="${i}" data-k="sb" type="number" min="0" value="${m.sb??''}" placeholder="0"></div></div>`).join('')||'<div class="empty">No bracket yet.</div>';
}
async function saveSeason(s){
  s.updated_at=new Date().toISOString();
  const payload={name:s.name,status:s.status,format:s.format,description:s.description,target_teams:s.target_teams,teams:s.teams,matches:s.matches,updated_at:s.updated_at};
  const {data,error}=await sb.from('seasons').update(payload).eq('id',s.id).select().single();
  if(error)throw error;const i=seasons.findIndex(x=>x.id===s.id);if(i>=0)seasons[i]=data;currentId=s.id;adminSeasonId=s.id;renderPublic();renderAdmin();
}
function openSeasonEditor(id){const s=seasons.find(x=>x.id===id);if(!s)return;$('editSeasonId').value=s.id;$('editSeasonName').value=s.name;$('editSeasonTarget').value=s.target_teams||16;$('editSeasonStatus').value=s.status||'Pendaftaran';$('editSeasonDescription').value=s.description||'';$('seasonEditorModal').classList.add('open');}
async function isAdmin(){const {data:{session}}=await sb.auth.getSession();return !!session;}
async function openPublicMatchEditor(matchId){
  if(!(await isAdmin()))return;
  const s=current();if(!s)return;adminSeasonId=s.id;const m=(s.matches||[]).find(x=>x.id===matchId);if(!m)return;
  $('quickMatchId').value=m.id;$('quickMatchA').value=m.a;$('quickMatchB').value=m.b;$('quickScoreA').value=m.sa??'';$('quickScoreB').value=m.sb??'';$('quickMatchRound').textContent=m.round||roundLabel(roundNumber(m));$('quickMatchModal').classList.add('open');
}
$('seasonSelect').onchange=e=>{currentId=e.target.value;renderPublic();document.querySelector('#tournament .bracket-head').scrollIntoView({behavior:'smooth'});};
$('bracketView').onclick=async e=>{const b=e.target.closest('.match-card');if(b)openPublicMatchEditor(b.dataset.matchId);};
$('adminOpen').onclick=async()=>{$('adminModal').classList.add('open');const {data:{session}}=await sb.auth.getSession();session?showAdmin():showLogin();};$('adminClose').onclick=()=>{$('adminModal').classList.remove('open')};$('adminModal').onclick=e=>{if(e.target===$('adminModal'))$('adminModal').classList.remove('open')};$('loginBtn').onclick=login;$('logoutBtn').onclick=logout;
document.querySelectorAll('.at').forEach(b=>b.onclick=()=>{document.querySelectorAll('.at').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ap').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.panel).classList.add('active');renderAdmin();});
$('seasonList').onclick=e=>{const b=e.target.closest('.manage');if(b)openSeasonEditor(b.dataset.id);};$('adminSeasonSelect').onchange=e=>{adminSeasonId=e.target.value;renderAdmin()};$('adminMatchSeason').onchange=e=>{adminSeasonId=e.target.value;renderAdmin()};
$('createSeason').onclick=async()=>{
  const name=$('newSeasonName').value.trim()||`TitikNgumpul Championship S${String(seasons.length+1).padStart(2,'0')}`;
  const target=Math.max(2,Math.min(MAX_TEAMS,Number($('newSeasonSize').value)||16));
  const s={name,status:'Pendaftaran',format:'Single Elimination',description:'Season baru TitikNgumpul.',target_teams:target,teams:[],matches:[]};
  const {data,error}=await sb.from('seasons').insert(s).select().single();if(error){alert(error.message);return}seasons.push(data);currentId=data.id;adminSeasonId=data.id;$('newSeasonName').value='';renderPublic();renderAdmin();
};
$('addTeam').onclick=async()=>{
  const s=adminSeason(),name=$('newTeamName').value.trim();if(!s||!name)return;
  s.teams=[...(s.teams||[]),{id:crypto.randomUUID(),name}];if(teamCount(s)>Number(s.target_teams||0))s.target_teams=teamCount(s);
  $('newTeamName').value='';try{await saveSeason(s)}catch(e){alert(e.message)}
};
$('newTeamName').onkeydown=e=>{if(e.key==='Enter')$('addTeam').click();};
$('addBulkTeams').onclick=async()=>{
  const s=adminSeason();if(!s)return;
  const raw=$('bulkTeams').value.trim();if(!raw){alert('Paste team names first. One team per line.');return;}
  const incoming=raw.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);const existing=new Set((s.teams||[]).map(t=>String(t.name||t).trim().toLowerCase()));
  const unique=incoming.filter(n=>{const k=n.toLowerCase();if(existing.has(k))return false;existing.add(k);return true;});
  if(!unique.length){alert('No new team names found.');return;}
  if(teamCount(s)+unique.length>MAX_TEAMS){alert(`Maximum is ${MAX_TEAMS} teams.`);return;}
  s.teams=[...(s.teams||[]),...unique.map(name=>({id:crypto.randomUUID(),name}))];if(teamCount(s)>Number(s.target_teams||0))s.target_teams=teamCount(s);
  $('bulkTeams').value='';try{await saveSeason(s);alert(`${unique.length} teams added.`)}catch(e){alert(e.message)}
};
$('teamList').onclick=async e=>{const b=e.target.closest('.remove-team');if(!b)return;const s=adminSeason();if(!confirm('Remove this participant?'))return;s.teams.splice(Number(b.dataset.i),1);try{await saveSeason(s)}catch(e){alert(e.message)}};
$('teamList').onchange=async e=>{const i=e.target.dataset.team;if(i===undefined)return;const s=adminSeason();s.teams[Number(i)].name=e.target.value.trim()||'TBD';try{await saveSeason(s)}catch(e){alert(e.message)}};
$('generateBracket').onclick=async()=>{const s=adminSeason();if(!s||teamCount(s)<2){alert('Minimum 2 participants.');return}if(!confirm('Rebuild the bracket from the current participant list? Existing match results will be replaced.'))return;try{s.matches=buildBracket(s.teams);recalc(s.matches);await saveSeason(s);alert('Bracket rebuilt.')}catch(e){alert(e.message)}};
$('shuffleBracket').onclick=async()=>{const s=adminSeason();if(!s||teamCount(s)<2){alert('Minimum 2 participants.');return}if(!confirm('Shuffle participants and rebuild the bracket? Existing match results will be replaced.'))return;try{s.teams=shuffleArray(s.teams||[]);s.matches=buildBracket(s.teams);recalc(s.matches);await saveSeason(s);alert('Participants shuffled and bracket updated.')}catch(e){alert(e.message)}};
$('saveBracket').onclick=async()=>{const s=adminSeason();if(!s)return;document.querySelectorAll('#matchEditor [data-i]').forEach(el=>{const m=s.matches[Number(el.dataset.i)],k=el.dataset.k;if(k==='a'||k==='b')m[k]=el.value.trim()||'TBD';else m[k]=el.value===''?null:Number(el.value)});recalc(s.matches);try{await saveSeason(s);alert('Bracket updated online.')}catch(e){alert(e.message)}};
$('resetSeason').onclick=async()=>{const s=adminSeason();if(!s||!confirm('Reset all scores?'))return;s.matches=(s.matches||[]).map(m=>({...m,sa:null,sb:null}));recalc(s.matches);try{await saveSeason(s)}catch(e){alert(e.message)}};
$('quickMatchClose').onclick=()=>$('quickMatchModal').classList.remove('open');$('quickMatchCancel').onclick=()=>$('quickMatchModal').classList.remove('open');$('quickMatchModal').onclick=e=>{if(e.target===$('quickMatchModal'))$('quickMatchModal').classList.remove('open')};
$('quickMatchSave').onclick=async()=>{
  const s=seasons.find(x=>x.id===adminSeasonId),id=$('quickMatchId').value;if(!s)return;const m=(s.matches||[]).find(x=>x.id===id);if(!m)return;
  m.sa=$('quickScoreA').value===''?null:Number($('quickScoreA').value);m.sb=$('quickScoreB').value===''?null:Number($('quickScoreB').value);recalc(s.matches);
  try{await saveSeason(s);$('quickMatchModal').classList.remove('open');}catch(e){alert(e.message)}
};
$('seasonEditorClose').onclick=()=>$('seasonEditorModal').classList.remove('open');$('seasonEditorModal').onclick=e=>{if(e.target===$('seasonEditorModal'))$('seasonEditorModal').classList.remove('open')};
$('saveSeasonEdit').onclick=async()=>{const s=seasons.find(x=>x.id===$('editSeasonId').value);if(!s)return;const target=Math.max(2,Math.min(MAX_TEAMS,Number($('editSeasonTarget').value)||16));s.name=$('editSeasonName').value.trim()||s.name;s.target_teams=Math.max(target,teamCount(s));s.status=$('editSeasonStatus').value;s.description=$('editSeasonDescription').value.trim();try{await saveSeason(s);$('seasonEditorModal').classList.remove('open');alert('Season updated.')}catch(e){alert(e.message)}};
$('deleteSeason').onclick=async()=>{const id=$('editSeasonId').value,s=seasons.find(x=>x.id===id);if(!s||!confirm(`Delete ${s.name}? This removes the season record and its bracket. This cannot be undone.`))return;const {error}=await sb.from('seasons').delete().eq('id',id);if(error){alert(error.message);return}seasons=seasons.filter(x=>x.id!==id);currentId=seasons[0]?.id||null;adminSeasonId=currentId||null;$('seasonEditorModal').classList.remove('open');renderPublic();renderAdmin();};
$('registerTournament').onclick=()=>{const s=current();if(s){const msg=encodeURIComponent(`Halo Una, saya ingin registrasi TitikNgumpul Tournament ${s.name}. Mohon info pendaftarannya.`);$('registerTournament').href=`https://wa.me/${CONTACTS[0].wa}?text=${msg}`}};
document.querySelectorAll('.catalog-tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.catalog-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.catalog-panel').forEach(p=>p.classList.remove('active'));tab.classList.add('active');const panel=document.querySelector(`.catalog-panel[data-panel="${tab.dataset.cat}"]`);if(panel)panel.classList.add('active');});
renderContacts();loadSeasons();sb.channel('tn-season-live-v6').on('postgres_changes',{event:'*',schema:'public',table:'seasons'},()=>loadSeasons()).subscribe();
