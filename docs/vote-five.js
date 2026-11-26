const clientVoteFive = window.supabase?.createClient(
  new URL(urlDisponibilites).origin, SUPABASE_KEY,
  { auth: { storageKey: 'bitume-session-joueur' } }
);

function initialiserVoteFive() {
  const carte = document.querySelector('#vote-five');
  if (!carte || carte.dataset.initialise) return;
  carte.dataset.initialise = 'true';
  carte.insertAdjacentHTML('beforeend', `
    <label hidden data-match>Choisis le Five<select></select></label>
    <p data-date></p><p data-compte></p>
    <form hidden><label>Ton numéro d’inscription<input required type="tel" autocomplete="tel"></label>
    <label>Ton homme du match<select required></select></label>
    <button class="btn">Valider mon vote</button></form>
    <p role="status" tabindex="-1"></p>`);
  const filtre = carte.querySelector('[data-match]');
  const selection = filtre.querySelector('select');
  const date = carte.querySelector('[data-date]');
  const compte = carte.querySelector('[data-compte]');
  const form = carte.querySelector('form');
  const joueurs = form.querySelector('select');
  const numero = form.querySelector('input');
  const bouton = form.querySelector('button');
  const message = carte.querySelector('[role=status]');
  const recus = new Map();
  let matchs = [], decalage = 0, derniereListe = '', enLecture = false;
  const libelle = m => new Date(m.debut).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'}) + ' · ' + (m.lieu || 'Five');

  function afficher() {
    const m = matchs.find(item => item.id === selection.value);
    if (!m) { form.hidden=true; date.textContent='Aucun Five publié.'; compte.textContent=''; return; }
    const debut = Date.parse(m.debut);
    const maintenant = Date.now()+decalage;
    const attente = maintenant<debut;
    const secondes = Math.max(0,Math.ceil(((attente?debut:debut+48*3600000)-maintenant)/1000));
    date.textContent = libelle(m);
    compte.textContent = secondes ? (attente?'Ouverture':'Clôture')+' du vote dans '+Math.floor(secondes/3600)+' h '+Math.floor(secondes%3600/60)+' min '+secondes%60+' s' : 'Vote terminé.';
    form.hidden = attente || !secondes || recus.has(m.id) || !m.candidats.length;
    const liste = JSON.stringify([m.id,m.candidats]);
    if (liste !== derniereListe) {
      const ancien = joueurs.value;
      joueurs.replaceChildren(new Option('Choisis un joueur',''),...m.candidats.map(j=>new Option(j.prenom,j.id)));
      joueurs.value = m.candidats.some(j=>j.id===ancien)?ancien:'';
      derniereListe=liste;
    }
  }
  async function charger() {
    if(enLecture) return;
    enLecture=true;
    try {
      const data=await rpcHistorique('scrutins_five');
      const precedent=selection.value;
      matchs=data;
      if(data.length) decalage=Date.parse(data[0].serveur)-Date.now();
      selection.replaceChildren(...data.map(m=>new Option(libelle(m),m.id)));
      if(data.some(m=>m.id===precedent)) selection.value=precedent;
      if(selection.value!==precedent) changer(); else afficher();
      filtre.hidden=data.length<2;
    } catch { if(!matchs.length) compte.textContent='Calendrier temporairement indisponible.'; }
    finally { enLecture=false; }
  }
  function changer() {
    numero.value='';
    message.textContent=recus.get(selection.value)||'';
    message.classList.toggle('vote-recu',recus.has(selection.value));
    afficher();
  }
  selection.onchange=changer;
  form.onsubmit=async e=>{
    e.preventDefault();
    const id=selection.value;
    if(bouton.disabled) return;
    bouton.disabled=selection.disabled=true;
    message.textContent='Enregistrement du vote…';
    try {
      const statut=await rpcHistorique('deposer_voix_five',{p_match:id,p_numero:normaliserTelephoneFive(numero.value),p_candidat:joueurs.value});
      if(!['enregistre','deja_vote'].includes(statut)) throw new Error('Vote non confirmé.');
      recus.set(id,statut==='enregistre'?'✓ Ton vote a été validé !':'✓ Un vote a déjà été enregistré pour ce numéro sur ce match.');
      if(selection.value===id){changer();message.focus();}
    } catch(err) {message.textContent=err.message;}
    finally {bouton.disabled=selection.disabled=false;}
  };
  // Les scripts différés suivants fournissent rpcHistorique avant cet appel.
  setTimeout(charger,0);
  const lecture=setInterval(charger,30000);
  const horloge=setInterval(()=>{
    if(!carte.isConnected){clearInterval(lecture);clearInterval(horloge);return;}
    if(matchs.length) afficher();
  },1000);
}
initialiserVoteFive();
window.addEventListener('hashchange',initialiserVoteFive);
window.addEventListener('pageshow',initialiserVoteFive);
