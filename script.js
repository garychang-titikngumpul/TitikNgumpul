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
const roundLabel=n=>({1:"Final",2:"Semifinal",4:"Quarterfinal",8:"Round of 16",16:"Round of 32",32:"Round of 64",64:"Round of 128"}[n]||`Round of ${n*2}`);
function winner(m){if(m.sa==null||m.sb==null||m.sa===m.sb)return "TBD";return Number(m.sa)>Number(m.sb)?m.a:m.b;}
function buildBracket(teams){
 const names=teams.map(t=>typeof t==='string'?t:t.name).filter(Boolean); if(names.length<2)return [];
 let size=1;while(size<names.length)size*=2; if(size>128)size=128;
 const slots=names.slice(0,size);while(slots.length<size)slots.push("BYE");
 let prev=slots.map((n,i)=>({a:n,b:"BYE",sa:n&&n!=="BYE"?1:null,sb:null}));
 // Pair teams in their listed order; if the second slot is a real team, score is blank.
 prev=[];for(let i=0;i<size;i+=2){const a=slots[i]||"BYE",b=slots[i+1]||"BYE";prev.push({a,b,sa:a!=="BYE"&&b!=="BYE"?null:(a!=="BYE"?1:null),sb:a==="BYE"&&b!=="BYE"?1:null});}
 const matches=[]; let count=size/2;
 prev.forEach((m,i)=>matches.push({id:`r${count}-${i+1}`,round:roundLabel(count),a:m.a,b:m.b,sa:m.sa,sb:m.sb}));
 let prevRound=prev;
 while(count>1){
   const nextCount=count/2; const round=roundLabel(nextCount); const next=[];
   for(let i=0;i<count;i+=2){const a=winner(prevRound[i]),b=winner(prevRound[i+1]);const m={id:`r${nextCount}-${i/2+1}`,round,a,b,sa:null,sb:null};next.push(m);matches.push(m);}
   prevRound=next;count=nextCount;
 }
 return matches;
}
function recalc(matches){
 const order={"Round of 128":128,"Round of 64":64,"Round of 32":32,"Round of 16":16,"Quarterfinal":4,"Semifinal":2,"Final":1};
 for(let i=0;i<matches.length;i++){const m=matches[i];const n=order[m.round];if(!n||n<=1)continue;const next=order[matches[i+Math.floor(n/2)]?.round]||n/2;}
 // Recalculate each round from the first round onward, preserving entered scores.
 const rounds=[...new Set(matches.map(m=>m.round))].sort((a,b)=> (order[b]||0)-(order[a]||0));
 for(let r=0;r<rounds.length-1;r++){
   const cur=matches.filter(m=>m.round===rounds[r]);const nxt=matches.filter(m=>m.round===rounds[r+1]);
   nxt.forEach((m,i)=>{m.a=cur[i*2]?winner(cur[i*2]):"TBD";m.b=cur[i*2+1]?winner(cur[i*2+1]):"TBD";if(m.a==="BYE")m.a="TBD";if(m.b==="BYE")m.b="TBD";});
 }
}
async function loadSeasons(){
 const {data,error}=await sb.from("seasons").select("*").order("created_at",{ascending:true});
 if(error){$("syncState").textContent="● Database error";console.error(error);return;}
 seasons=data||[];if(!currentId&&seasons[0])currentId=seasons[0].id;if(currentId&&!seasons.some(s=>s.id===currentId))currentId=seasons[0]?.id||null;
 renderPublic();$("syncState").textContent="● Online & realtime";if(!$('adminPanel').classList.contains('hidden'))renderAdmin();
}
function current(){return seasons.find(s=>s.id===currentId)||seasons[0];}
function renderPublic(){
 const s=current(); if(!s){$("seasonSelect").innerHTML="";$("seasonTitle").textContent="Belum ada season";$("seasonTeams").textContent="0 Teams";$("seasonRegistration").textContent="0 / 0 Teams";$("bracketView").innerHTML='<div class="empty">Belum ada season.</div>';return;}
 $("seasonSelect").innerHTML=seasons.map(x=>`<option value="${x.id}" ${x.id===s.id?'selected':''}>${esc(x.name)}</option>`).join("");
 $("seasonTitle").textContent=s.name;$("seasonStatus").textContent="● "+s.status;$("seasonTeams").textContent=teamCount(s)+" Teams";$("seasonRegistration").textContent=`${teamCount(s)} / ${s.target_teams} Teams`;$("seasonDesc").textContent=s.description||"";
 const pct=s.target_teams?Math.min(100,teamCount(s)/s.target_teams*100):0;$("registrationProgress").style.width=pct+"%";
 const ms=JSON.parse(JSON.stringify(s.matches||[]));recalc(ms);renderBracket(ms);
}
function renderBracket(matches){
 if(!matches.length){$("bracketView").innerHTML='<div class="empty">Bracket belum dibuat. Admin dapat membuat bracket dari daftar registrasi.</div>';return;}
 const order={"Round of 128":128,"Round of 64":64,"Round of 32":32,"Round of 16":16,"Quarterfinal":4,"Semifinal":2,"Final":1};
 const rounds=[...new Set(matches.map(m=>m.round))].sort((a,b)=>(order[b]||0)-(order[a]||0));
 $("bracketView").innerHTML=rounds.map(r=>`<div class="round"><h4>${r}</h4>${matches.filter(m=>m.round===r).map(m=>`<div class="match-box"><div class="match-line ${m.sa!=null&&m.sb!=null&&Number(m.sa)>Number(m.sb)?'win':''}"><span>${esc(m.a)}</span><span class="score">${m.sa??'—'}</span></div><div class="match-line ${m.sa!=null&&m.sb!=null&&Number(m.sb)>Number(m.sa)?'win':''}"><span>${esc(m.b)}</span><span class="score">${m.sb??'—'}</span></div></div>`).join('')}</div>`).join('');
}
function renderContacts(){$("contacts").innerHTML=CONTACTS.map(c=>`<div class="contact"><b>${c.name}</b><a href="https://wa.me/${c.wa}" target="_blank" rel="noopener">${c.phone}</a></div>`).join("");}
async function login(){const email=$("loginEmail").value.trim(),password=$("loginPassword").value;const {error}=await sb.auth.signInWithPassword({email,password});$("loginMsg").textContent=error?error.message:"Login berhasil.";if(!error)showAdmin();}
async function logout(){await sb.auth.signOut();showLogin();}
async function showAdmin(){const {data:{session}}=await sb.auth.getSession();if(!session){showLogin();return;}$("loginPanel").classList.add("hidden");$("adminPanel").classList.remove("hidden");renderAdmin();}
function showLogin(){$("loginPanel").classList.remove("hidden");$("adminPanel").classList.add("hidden");}
function adminSeason(){return seasons.find(s=>s.id===adminSeasonId);}
function renderAdmin(){
 const opts=seasons.map(s=>`<option value="${s.id}" ${s.id===adminSeasonId?'selected':''}>${esc(s.name)}</option>`).join('');$("adminSeasonSelect").innerHTML=opts;$("adminMatchSeason").innerHTML=opts;if(!adminSeasonId)adminSeasonId=currentId;$("adminSeasonSelect").value=adminSeasonId;$("adminMatchSeason").value=adminSeasonId;
 $("seasonList").innerHTML=seasons.map(s=>`<div class="season-admin-item"><div><b>${esc(s.name)}</b><small>${esc(s.status)} · ${teamCount(s)} / ${s.target_teams} teams</small></div><button class="outline-btn manage" data-id="${s.id}">Kelola</button></div>`).join('');renderTeams();renderMatches();
}
function renderTeams(){const s=adminSeason();if(!s){$("teamList").innerHTML="";return;}$("teamList").innerHTML=(s.teams||[]).map((t,i)=>`<div class="team-row"><span>#${i+1}</span><input data-team="${i}" value="${esc(t.name||t)}"><button class="danger-btn remove-team" data-i="${i}">Hapus</button></div>`).join('')||'<div class="empty">Belum ada tim.</div>';}
function renderMatches(){const s=adminSeason();if(!s){$("matchEditor").innerHTML="";return;}$("matchEditor").innerHTML=(s.matches||[]).map((m,i)=>`<div class="match-editor"><span class="roundname">${esc(m.round)}</span><input data-i="${i}" data-k="a" value="${esc(m.a)}"><input data-i="${i}" data-k="b" value="${esc(m.b)}"><div class="score-inputs"><input data-i="${i}" data-k="sa" type="number" min="0" value="${m.sa??''}" placeholder="0"><input data-i="${i}" data-k="sb" type="number" min="0" value="${m.sb??''}" placeholder="0"></div></div>`).join('')||'<div class="empty">Belum ada bracket.</div>';}
async function saveSeason(s){s.updated_at=new Date().toISOString();const {data,error}=await sb.from('seasons').update({name:s.name,status:s.status,format:s.format,description:s.description,target_teams:s.target_teams,teams:s.teams,matches:s.matches,updated_at:s.updated_at}).eq('id',s.id).select().single();if(error)throw error;const i=seasons.findIndex(x=>x.id===s.id);if(i>=0)seasons[i]=data;currentId=s.id;adminSeasonId=s.id;renderPublic();renderAdmin();}

$("seasonSelect").onchange=e=>{currentId=e.target.value;renderPublic();$("bracket").scrollIntoView({behavior:'smooth'});};
$("adminOpen").onclick=async()=>{$("adminModal").classList.add('open');const {data:{session}}=await sb.auth.getSession();session?showAdmin():showLogin();};
$("adminClose").onclick=()=>$("adminModal").classList.remove('open');$("adminModal").onclick=e=>{if(e.target===$("adminModal"))$("adminModal").classList.remove('open');};$("loginBtn").onclick=login;$("logoutBtn").onclick=logout;
document.querySelectorAll('.at').forEach(b=>b.onclick=()=>{document.querySelectorAll('.at').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.ap').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.panel).classList.add('active');renderAdmin();});
$("seasonList").onclick=e=>{const b=e.target.closest('.manage');if(b){adminSeasonId=b.dataset.id;renderAdmin();}};$("adminSeasonSelect").onchange=e=>{adminSeasonId=e.target.value;renderAdmin();};$("adminMatchSeason").onchange=e=>{adminSeasonId=e.target.value;renderAdmin();};
$("createSeason").onclick=async()=>{const name=$("newSeasonName").value.trim()||`TitikNgumpul Championship S${String(seasons.length+1).padStart(2,'0')}`,target=Math.max(2,Math.min(128,Number($("newSeasonSize").value)||16));const s={name,status:'Pendaftaran',format:'Single Elimination',description:'Season baru TitikNgumpul.',target_teams:target,teams:[],matches:[]};const {data,error}=await sb.from('seasons').insert(s).select().single();if(error){alert(error.message);return;}seasons.push(data);currentId=data.id;adminSeasonId=data.id;$("newSeasonName").value='';renderPublic();renderAdmin();};
$("addTeam").onclick=async()=>{const s=adminSeason(),name=$("newTeamName").value.trim();if(!s||!name)return;if(teamCount(s)>=s.target_teams){alert('Target registrasi season ini sudah penuh.');return;}s.teams=[...(s.teams||[]),{id:crypto.randomUUID(),name}];$("newTeamName").value='';try{await saveSeason(s);}catch(e){alert(e.message);}};
$("teamList").onclick=async e=>{const b=e.target.closest('.remove-team');if(!b)return;const s=adminSeason();if(!confirm('Hapus tim ini dari registrasi?'))return;s.teams.splice(Number(b.dataset.i),1);try{await saveSeason(s);}catch(e){alert(e.message);}};
$("teamList").onchange=async e=>{const i=e.target.dataset.team;if(i===undefined)return;const s=adminSeason();s.teams[Number(i)].name=e.target.value.trim()||'TBD';try{await saveSeason(s);}catch(e){alert(e.message);}};
$("generateBracket").onclick=async()=>{const s=adminSeason();if(!s)return;if(teamCount(s)<2){alert('Minimal 2 tim untuk membuat bracket.');return;}if(!confirm('Buat ulang bracket dari registrasi saat ini? Bracket lama akan diganti.'))return;s.matches=buildBracket(s.teams);recalc(s.matches);try{await saveSeason(s);alert('Bracket baru berhasil dibuat.');}catch(e){alert(e.message);}};
$("saveBracket").onclick=async()=>{const s=adminSeason();if(!s)return;document.querySelectorAll('#matchEditor [data-i]').forEach(el=>{const m=s.matches[Number(el.dataset.i)],k=el.dataset.k;if(k==='a'||k==='b')m[k]=el.value.trim()||'TBD';else m[k]=el.value===''?null:Number(el.value);});recalc(s.matches);try{await saveSeason(s);alert('Bracket berhasil diperbarui dan tersimpan online.');}catch(e){alert(e.message);}};
$("resetSeason").onclick=async()=>{const s=adminSeason();if(!s||!confirm('Reset seluruh skor season ini?'))return;s.matches=(s.matches||[]).map(m=>({...m,sa:null,sb:null}));recalc(s.matches);try{await saveSeason(s);}catch(e){alert(e.message);}};
document.querySelectorAll('.order').forEach(b=>b.onclick=()=>{const msg=encodeURIComponent(`Halo TitikNgumpul, saya ingin memesan ${b.dataset.product}. Mohon info harga, ukuran, dan stok.`);window.open(`https://wa.me/${CONTACTS[0].wa}?text=${msg}`,'_blank');});
renderContacts();
sb.auth.onAuthStateChange(()=>{});
loadSeasons();
sb.channel('tn-season-live-v4').on('postgres_changes',{event:'*',schema:'public',table:'seasons'},()=>loadSeasons()).subscribe();
