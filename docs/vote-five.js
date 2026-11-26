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
    const secondes = Math.max(0,Math.ceil(((attente?debut:debut+24*3600000)-maintenant)/1000));
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
      const cible = location.hash.startsWith('#vote/') ? location.hash.slice(6) : '';
      const precedent=selection.value;
      matchs=data;
      if(data.length) decalage=Date.parse(data[0].serveur)-Date.now();
      selection.replaceChildren(...data.map(m=>new Option(libelle(m),m.id)));
      if (cible) {
        selection.value = cible;
        if (!selection.value) {
          form.hidden = true;
          filtre.hidden = true;
          date.textContent = 'Le vote de ce Five est terminé ou indisponible.';
          compte.textContent = '';
          matchs = [];
          return;
        }
      } else if(data.some(m=>m.id===precedent)) selection.value=precedent;
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
  selection.onchange=() => {
    if (location.hash.startsWith('#vote/')) location.hash = 'vote/' + selection.value;
    else changer();
  };
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

function initialiserVotesAccueil() {
  const section = document.querySelector('#votes-accueil');
  if (!section || section.dataset.initialise) return;
  section.dataset.initialise = 'true';
  let matchs = [], decalage = 0, chargement = false;
  function afficher() {
    const maintenant = Date.now() + decalage;
    const ouverts = matchs.filter(m => maintenant < Date.parse(m.fin));
    section.hidden = ouverts.length === 0;
    const lignes = ouverts.map(m => {
      const minutes = Math.ceil((Date.parse(m.fin) - maintenant) / 60000);
      const lien = document.createElement('a');
      lien.href = '#vote/' + m.id;
      const date = new Date(m.debut).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short'
      });
      const titre = document.createElement('strong');
      titre.textContent = 'Homme du match';
      const details = document.createElement('span');
      details.textContent = date + (m.lieu ? ' · ' + m.lieu : '');
      const delai = document.createElement('small');
      delai.textContent = 'Fin dans ' + Math.floor(minutes / 60) + ' h ' + String(minutes % 60).padStart(2, '0') + ' min';
      const action = document.createElement('b');
      action.textContent = 'Je vote →';
      const logo = document.createElement('img');
      logo.src = 'logo.PNG';
      logo.alt = '';
      const statut = document.createElement('span');
      statut.className = 'statut-scrutin';
      statut.textContent = 'Vote ouvert';
      lien.append(logo, statut, titre, details, delai, action);
      return lien;
    });
    if (section.textContent !== lignes.map(el => el.textContent).join('') ||
        lignes.some((el, i) => el.href !== section.children[i]?.href))
      section.replaceChildren(...lignes);
  }
  async function charger() {
    if (chargement || !section.isConnected) return;
    chargement = true;
    try {
      const liste = await rpcHistorique('scrutins_five');
      if (liste.length) decalage = Date.parse(liste[0].serveur) - Date.now();
      matchs = liste.filter(m => Date.parse(m.debut) <= Date.parse(m.serveur))
        .map(m => ({ ...m, fin: new Date(Date.parse(m.debut) + 24 * 3600000).toISOString() }));
      afficher();
    } catch { afficher(); }
    finally { chargement = false; }
  }
  setTimeout(charger, 0);
  const lecture = setInterval(charger, 30000);
  const horloge = setInterval(() => {
    if (section.isConnected) afficher();
    else { clearInterval(lecture); clearInterval(horloge); }
  }, 1000);
}
initialiserVotesAccueil();
window.addEventListener('hashchange', initialiserVotesAccueil);
window.addEventListener('pageshow', initialiserVotesAccueil);
