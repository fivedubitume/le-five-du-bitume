const app = document.querySelector('#app');
const status = document.querySelector('#status');
const seed = {
  players: [
    {id:'me', name:'Yassine', position:'Gardien', phone:'', history:[]},
    {id:'p1', name:'Nassim', position:'Attaquant', history:[], baseline:8.6, games:9},
    {id:'p2', name:'Matéo', position:'Ailier', history:[], baseline:8.3, games:8},
    {id:'p3', name:'Samir', position:'Défenseur', history:[], baseline:8.1, games:7}
  ],
  matches:[{id:'m1', title:'Five du mercredi', date:'2026-11-25T20:15', venue:'Wittenheim', price:15, capacity:5, entries:['p1','p2','p3'], wait:[], presence:{}, votes:{}, open:false},
    {id:'m2', title:'Five du 18 novembre', date:'2026-11-18T20:15', venue:'Wittenheim', price:15, capacity:10, entries:['me','p1','p2','p3'], wait:[], presence:{me:'present',p1:'present',p2:'present',p3:'present'}, votes:{}, open:true, result:'8 – 6'}],
  cups:[{id:'t1',title:'Coupe de la trêve',date:'2026-12-09',format:'Équipes de 5',teams:['Les Éclairs','Impact Five'],result:''}]
};
let state;
try { state = JSON.parse(localStorage.getItem('five-wittenheim-v1')) || structuredClone(seed); }
catch { state = structuredClone(seed); }
const me = () => state.players.find(p => p.id === 'me');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = date => new Intl.DateTimeFormat('fr-FR',{dateStyle:'full',timeZone:'UTC'}).format(new Date(date.slice(0,10)+'T12:00:00Z'));
const timestamp = date => {
  const wallTime = Date.parse(date+'Z');
  const parisTime = new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',timeZoneName:'longOffset'}).format(new Date(wallTime));
  const offset = parisTime.match(/UTC([+-]\d\d):(\d\d)/);
  return wallTime - (offset ? (Number(offset[1])*60 + Math.sign(Number(offset[1]))*Number(offset[2]))*60000 : 0);
};
const now = () => timestamp(state.clock || '2026-11-19T16:00');
const canVote = m => m.open && ['present','late'].includes(m.presence.me) && !excluded(me());
const label = {late:'Retard', noShow:'Absence sans prévenir', lateCancel:'Désistement tardif'};
const sanction = player => {
  const incidents = player.history;
  if (incidents.some(i => i.kind==='noShow') || incidents.length >= 3) return '🟥 Carton rouge';
  return incidents.length === 2 ? '🟨 Carton jaune' : incidents.length === 1 ? '⬜ Carton blanc' : 'Aucun carton';
};
const excluded = player => sanction(player).startsWith('🟥');
const player = id => state.players.find(p => p.id === id);
const btn = (label, action, id, alt=false) => `<button type="button" class="btn ${alt?'alt':''}" data-action="${action}" data-id="${id}">${label}</button>`;
const field = (name,label,value='',type='text',attrs='') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${attrs}></label>`;
const rosterRow = (p,note='') => `<div class="row"><div class="player"><span class="avatar">${p.photo?`<img src="${esc(p.photo)}" alt="">`:esc(p.name.slice(0,2).toUpperCase())}</span><div><strong>${esc(p.name)}</strong><br><small>${esc(p.position)}</small></div></div><span class="score">${note}</span></div>`;
function rankings() {
  return state.players.map(p => {
    const scores = state.matches.flatMap(m => {
      if (m.open) return [];
      const votes = Object.values(m.votes).map(v => v.notes[p.id]).filter(n => Number.isFinite(n));
      return votes.length >= 3 ? [votes.reduce((sum,n)=>sum+n,0)/votes.length] : [];
    });
    const games = (p.games ?? 0) + scores.length;
    const average = games ? ((p.baseline ?? 0)*(p.games ?? 0)+scores.reduce((sum,n)=>sum+n,0))/games : 0;
    return {p,games,average};
  }).filter(r=>r.games>=5 && !excluded(r.p)).sort((a,b)=>b.average-a.average);
}
function home() {
  return `<section class="hero hero-five hero-photo"><div class="hero-photo-colonne"><div class="hero-photo-cadre"><img class="hero-photo-joueurs" src="joueurs-bitume.webp" alt="Deux joueurs du Five du Bitume en action sur un terrain indoor" width="1672" height="941" fetchpriority="high"></div><div class="hero-five-intro"><p class="tag">Football à 5 · Wittenheim</p><h1>LE FIVE DU BITUME</h1><p id="prochain-five">Chargement du prochain Five…</p><div class="actions"><a class="btn" href="joueur.html">Je prends ma place</a> <a class="btn alt" href="joueur.html?retrait=1">Je retire ma place</a></div></div></div><div id="accueil-feuille"></div></section>
  <section class="card regles-groupe" id="regles-du-groupe"><h2>Règles du groupe</h2><p class="muted">Les règles seront publiées ici.</p></section>`;
}
function summary(m) {
  if (m.open) return '<p class="muted">Votes en cours</p>';
  const votes = Object.values(m.votes);
  if (!votes.length) return '<p class="muted">Aucun vote enregistré</p>';
  const tally = new Map();
  votes.forEach(v=>tally.set(v.mvp,(tally.get(v.mvp)??0)+1));
  const highest = Math.max(...tally.values());
  const winners = [...tally].filter(([,count])=>count===highest).map(([id])=>player(id)?.name).filter(Boolean);
  return `<p>Note du match · ${(votes.reduce((sum,v)=>sum+v.match,0)/votes.length).toFixed(1)}/10<br>Joueur du match · ${esc(winners.join(', '))}</p>`;
}
function votes(id){
  const m=state.matches.find(match=>match.id===id);
  if(!m || !canVote(m)) return '<h1>Vote indisponible</h1>';
  const current=m.votes.me;
  const candidates=m.entries.filter(id=>id!=='me' && ['present','late'].includes(m.presence[id]));
  if(!candidates.length) return '<h1>Vote indisponible</h1><p>Aucun autre joueur présent.</p>';
  return `<h1>Votes du match</h1><form class="card section" data-form="vote" data-id="${m.id}">${field('match','Note du match sur 10',current?.match,'number','min="0" max="10" step="0.5" required')}
  <label>Joueur du match<select name="mvp">${candidates.map(id=>`<option value="${id}" ${current?.mvp===id?'selected':''}>${esc(player(id).name)}</option>`).join('')}</select></label><h3>Notes des joueurs</h3>
  ${candidates.map(id=>field('note_'+id,esc(player(id).name)+' · sur 10',current?.notes[id],'number','min="0" max="10" step="0.5" class="vote"')).join('')}<button class="btn">Enregistrer mes votes</button></form>`;
}
function cups() {
  return `<h1>Tournois de la trêve</h1><div class="grid">${state.cups.map(c=>`<section class="card"><p class="tag">${esc(c.format)}</p><h2>${esc(c.title)}</h2><p>${dateLabel(c.date)}</p><h3>Équipes inscrites</h3>${c.teams.map(team=>`<div class="row">${esc(team)}</div>`).join('')}${c.result?`<p class="section"><strong>Vainqueur</strong> · ${esc(c.result)}</p>`:excluded(me())?'':`<form class="section" data-form="team" data-id="${c.id}">${field('team','Nom de ton équipe','','text','required maxlength="40"')}<button class="btn">Inscrire mon équipe</button></form>`}</section>`).join('')||'<p>Aucun tournoi programmé.</p>'}<section class="card"><p class="tag">Challenge</p><h2>Meilleur joueur</h2><p>La moyenne de la saison départage les joueurs qui comptent au moins cinq matchs évalués.</p><a class="btn alt" href="#classement">Voir le classement</a></section></div>`;
}
function profile() {
  const p=me();
  return `<h1>Ma carte joueur</h1><div class="grid"><section class="card">${rosterRow(p)}<h3 class="section">${sanction(p)}</h3>${p.history.map(i=>`<div class="row"><span>${esc(label[i.kind])}</span><span>${esc(state.matches.find(m=>m.id===i.match)?.title)}</span></div>`).join('')}</section><form class="card" data-form="profile">${field('name','Prénom',p.name,'text','required maxlength="30"')}${field('position','Poste',p.position,'text','required maxlength="30"')}${field('phone','Numéro de démonstration',p.phone,'tel','maxlength="25" placeholder="Utilise un numéro fictif"')}<label>Photo de profil<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"></label><button class="btn">Enregistrer mon profil</button></form></div>`;
}
function matchFields(m={}) {
  return field('title','Nom du match',m.title,'text','required maxlength="60"')+field('date','Date et heure (Paris)',m.date,'datetime-local','required')+field('venue','Terrain',m.venue??'Wittenheim','text','required maxlength="60"')+field('price','Prix en euros',m.price??15,'number','required min="0" max="100" step="0.5"')+field('capacity','Places',m.capacity??10,'number',`required min="${Math.max(2,m.entries?.length??0)}" max="120"`);
}
function admin() {
  return `<h1>Tableau de bord</h1><p class="section muted">Admin démo · modifications enregistrées dans ce navigateur.</p><form class="card section" data-form="clock">\${field('clock','Date et heure simulées (Paris)',state.clock||'2026-11-19T16:00','datetime-local','required')}<button class="btn alt">Changer la date simulée</button></form><div class="grid"><form class="card" data-form="match"><h2>Nouveau match</h2>${matchFields()}<button class="btn">Créer le match</button></form>
  <form class="card" data-form="cup"><h2>Nouveau tournoi</h2>${field('title','Nom','','text','required maxlength="60"')}${field('date','Date','','date','required')}${field('format','Format','Équipes de 5','text','required maxlength="60"')}<button class="btn">Créer le tournoi</button></form></div>
  <div class="grid">${state.matches.map(m=>`<section class="card"><h2>${esc(m.title)}</h2><details><summary>Modifier le match</summary><form class="section" data-form="match" data-id="${m.id}">${matchFields(m)}<button class="btn">Enregistrer</button></form></details><form class="section" data-form="presence" data-id="${m.id}"><h3>Feuille de présence</h3>${m.entries.map(id=>`<label>${esc(player(id).name)}<select name="presence_${id}">${[['','À renseigner'],['present','À l’heure'],['late','En retard'],['noShow','Absent sans prévenir']].map(([value,name])=>`<option value="${value}" ${(m.presence[id]??'')===value?'selected':''}>${name}</option>`).join('')}</select></label>`).join('')}${field('result','Score',m.result,'text','maxlength="35"')}<label>Votes<select name="open"><option value="0">Fermés</option><option value="1" ${m.open?'selected':''}>Ouverts</option></select></label><button class="btn">Valider la feuille</button></form></section>`).join('')}</div>
  <div class="grid">${state.cups.map(c=>`<form class="card" data-form="cup" data-id="${c.id}"><h2>${esc(c.title)}</h2>${field('title','Nom',c.title,'text','required maxlength="60"')}${field('date','Date',c.date,'date','required')}${field('format','Format',c.format,'text','required maxlength="60"')}<label>Vainqueur<select name="result"><option value="">À désigner</option>${c.teams.map(t=>`<option ${c.result===t?'selected':''}>${esc(t)}</option>`).join('')}</select></label><button class="btn">Enregistrer</button></form>`).join('')}</div>`;
}
function afficherClassements(categorie) {
  const criteres = [
    { id: 'victoires', nom: 'Victoires' },
    { id: 'homme-du-match', nom: 'Homme du match' },
    { id: 'moyenne', nom: 'Note moyenne' }
  ];
  const actif = criteres.find(critere => critere.id === categorie) ?? criteres[0];
  const liens = criteres.map(critere =>
    `<a class="btn ${critere === actif ? '' : 'alt'}" href="#classements/${critere.id}"${critere === actif ? ' aria-current="page"' : ''}>${critere.nom}</a>`
  ).join('');
  return `<section class="classements-ensemble"><div class="classements-bandeau"><h1>Classements</h1><div class="actions classements-filtres" role="group" aria-label="Filtres du classement">${liens}</div></div><section class="card classements-resultats"><h2>${actif.nom}</h2><div id="historique-five" data-classement="${actif.id}">Chargement…</div></section></section>`;
}

function render() {
  const [route, categorie] = location.hash.slice(1).split('/');
  const pages = {
    accueil: home,
    classements: afficherClassements,
    vote: () => '<section class="card" id="vote-five"><h1>Vote pour l’homme du match</h1></section><section class="card section" id="notes-five"><h2>Noter les joueurs</h2></section>',
    cartons: () => '<h1>Les cartons des joueurs</h1><section class="card" id="cartons-five">Chargement…</section>'
  };
  const page = Object.hasOwn(pages, route) ? route : 'accueil';
  document.querySelectorAll('header nav a').forEach(lien => {
    if (lien.hash === '#' + page) lien.setAttribute('aria-current', 'page');
    else lien.removeAttribute('aria-current');
  });
  app.innerHTML = pages[page](categorie);
}
function commit(message) {
  try { localStorage.setItem('five-wittenheim-v1',JSON.stringify(state)); status.textContent=message; }
  catch { status.textContent='Enregistrement local indisponible.'; }
  render();
}
function fill(m) {
  while(m.entries.length<m.capacity && m.wait.length) {
    const id=m.wait.shift();
    if(!excluded(player(id))) m.entries.push(id);
  }
}
function releaseExcluded() {
  state.matches.filter(m=>timestamp(m.date)>now() && !m.result).forEach(m=>{
    m.entries=m.entries.filter(id=>!excluded(player(id)) || Object.hasOwn(m.presence,id));
    m.wait=m.wait.filter(id=>!excluded(player(id)));
    fill(m);
  });
}
app.addEventListener('click',event=>{
  const target=event.target.closest('[data-action]');
  if(!target) return;
  const m=state.matches.find(match=>match.id===target.dataset.id);
  if (!m || timestamp(m.date)<=now() || m.result || excluded(me())) return;
  if(target.dataset.action==='join' && !m.entries.includes('me') && !m.wait.includes('me')){
    const full=m.entries.length>=m.capacity;
    (full?m.wait:m.entries).push('me');
    commit(full?'Tu es sur la liste d’attente.':'Ta place est réservée.');
  }
  if(target.dataset.action==='leave'){
    if(m.entries.includes('me') && timestamp(m.date)-now()<86400000){
      me().history.push({match:m.id,kind:'lateCancel'});
    }
    m.entries=m.entries.filter(id=>id!=='me');
    m.wait=m.wait.filter(id=>id!=='me');
    fill(m);
    releaseExcluded();
    commit('Désistement enregistré.');
  }
});
app.addEventListener('submit',async event=>{
  event.preventDefault();
  const form=event.target;
  const data=new FormData(form);
  const id=form.dataset.id;
  const m=state.matches.find(match=>match.id===id);
  const c=state.cups.find(cup=>cup.id===id);
  const value=key=>String(data.get(key)??'').trim();
  switch(form.dataset.form){
    case 'clock':
      state.clock=value('clock');
      break;
    case 'profile': {
      if(!value('name') || !value('position')) return;
      const photo=data.get('photo');
      if(photo.size){
        if(photo.size>1000000 || !['image/jpeg','image/png','image/webp'].includes(photo.type)){
          status.textContent='Choisis une photo JPEG, PNG ou WebP de moins de 1 Mo.';
          return;
        }
        me().photo=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>resolve('');reader.readAsDataURL(photo);});
      }
      Object.assign(me(),{name:value('name'),position:value('position'),phone:value('phone')});
      break;
    }
    case 'match': {
      const details={title:value('title'),date:value('date'),venue:value('venue'),price:Number(value('price')),capacity:Number(value('capacity'))};
      if(m){Object.assign(m,details);fill(m);}
      else state.matches.push({...details,id:crypto.randomUUID(),entries:[],wait:[],presence:{},votes:{},open:false});
      break;
    }
    case 'presence':
      if(!m) return;
      for(const id of m.entries){
        const p=player(id);
        const prior=p.history.filter(i=>i.match===m.id && i.kind!=='lateCancel');
        p.history=p.history.filter(i=>!prior.includes(i));
        const entry=value('presence_'+id);
        if(entry) m.presence[id]=entry;
        else delete m.presence[id];
        if(entry==='late'||entry==='noShow') p.history.push({match:m.id,kind:entry});
      }
      m.result=value('result');
      m.open=Boolean(m.result)&&value('open')==='1';
      releaseExcluded();
      break;
    case 'vote': {
      if(!m?.open || !['present','late'].includes(m.presence.me) || excluded(me()))return;
      const candidates=m.entries.filter(id=>id!=='me' && ['present','late'].includes(m.presence[id]));
      if(!candidates.includes(value('mvp')))return;
      const notes=Object.fromEntries(candidates.filter(id=>value('note_'+id)!=='').map(id=>[id,Number(value('note_'+id))]));
      m.votes.me={match:Number(value('match')),mvp:value('mvp'),notes};
      break;
    }
    case 'cup': {
      const details={title:value('title'),date:value('date'),format:value('format'),result:value('result')};
      if(c)Object.assign(c,details);
      else state.cups.push({...details,id:crypto.randomUUID(),teams:[]});
      break;
    }
    case 'team':
      if(!c || c.result || excluded(me()) || !value('team') || c.teams.some(t=>t.toLowerCase()===value('team').toLowerCase()))return;
      c.teams.push(value('team'));
      break;
    default: return;
  }
  commit('Modification enregistrée.');
});
window.addEventListener('hashchange',()=>{status.textContent='';render();window.scrollTo(0,0);});
render();
