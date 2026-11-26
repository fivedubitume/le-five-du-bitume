const dateHistorique = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long', timeZone: 'Europe/Paris'
});

function elementHistorique(tag, texte) {
  const element = document.createElement(tag);
  element.textContent = texte;
  return element;
}

async function rpcHistorique(nom, argumentsRpc = {}, token) {
  const url = new URL('/rest/v1/rpc/' + nom, urlDisponibilites);
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const reponse = await fetch(url, { method: 'POST', headers, body: JSON.stringify(argumentsRpc) });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.message || 'Données indisponibles.');
  return data;
}

function afficherClassementReel(zone, lignes) {
  const indicateurs = { victoires: 'victoires', 'homme-du-match': 'titres', moyenne: 'moyenne' };
  const indicateur = indicateurs[zone.dataset.classement];
  const joueurs = lignes.filter(joueur => joueur[indicateur] !== null &&
      (indicateur === 'moyenne' || joueur[indicateur] > 0))
    .sort((a, b) => Number(b[indicateur]) - Number(a[indicateur]) ||
      (a.prenom || '').localeCompare(b.prenom || '', 'fr'));
  zone.replaceChildren();
  if (!joueurs.length) zone.textContent = 'Aucun classement disponible pour le moment.';
  let rang = 0;
  joueurs.forEach((joueur, index) => {
    if (!index || Number(joueur[indicateur]) !== Number(joueurs[index - 1][indicateur])) rang = index + 1;
    const ligne = document.createElement('div');
    ligne.className = 'row';
    const total = indicateur === 'moyenne'
      ? `${Number(joueur.moyenne).toLocaleString('fr-FR')} / 10 · ${joueur.notes_recues} note(s)`
      : `${joueur[indicateur]}`;
    ligne.append(elementHistorique('span', `${rang}. ${joueur.prenom || 'Joueur'}`),
      elementHistorique('strong', total));
    zone.append(ligne);
  });
}

function afficherCartonsReels(zone, cartons) {
  zone.replaceChildren();
  if (!cartons.length) zone.textContent = 'Aucun carton enregistré.';
  let jourCourant = '';
  for (const carton of cartons) {
    const jour = dateHistorique.format(new Date(carton.date_match));
    if (jour !== jourCourant) zone.append(elementHistorique('h2', jour));
    jourCourant = jour;
    const ligne = elementHistorique('p', `${carton.prenom} · Carton ${carton.couleur}`);
    ligne.className = 'row';
    zone.append(ligne);
  }
}

async function afficherNotesFive(zone) {
  const message = elementHistorique('p', 'Chargement…');
  message.setAttribute('role', 'status');
  zone.append(message);
  try {
    const { data: { session }, error } = await clientVoteFive.auth.getSession();
    if (error) throw error;
    if (!session) {
      message.textContent = 'Utilise le navigateur avec lequel tu as réservé.';
      return;
    }
    const rpc = async (nom, data) => {
      const { data: retour, error: erreur } = await clientVoteFive.rpc(nom, data);
      if (erreur) throw erreur;
      return retour;
    };
    const matchs = await rpc('matchs_a_noter_five');
    if (!matchs.length) {
      message.textContent = 'Aucun joueur à noter pour le moment.';
      return;
    }

    const form = document.createElement('form');
    const match = document.createElement('select');
    const joueur = document.createElement('select');
    const note = document.createElement('input');
    Object.assign(note, { type: 'number', min: '0', max: '10', step: '0.1', required: true });
    const bouton = elementHistorique('button', 'Enregistrer la note');
    bouton.className = 'btn';
    const champs = [
      ['Five', match], ['Joueur à noter', joueur], ['Note sur 10', note]
    ];
    for (const [titre, champ] of champs) {
      const label = elementHistorique('label', titre);
      label.append(champ);
      form.append(label);
    }
    form.append(bouton);
    zone.append(form);
    match.replaceChildren(...matchs.map(item => new Option(dateHistorique.format(new Date(item.debut)), item.id)));
    joueur.required = true;

    function afficherJoueurs(joueurs) {
      joueur.replaceChildren(new Option('Choisir un joueur', ''),
        ...joueurs.map(item => new Option(item.prenom || 'Joueur', item.id)));
      bouton.disabled = !joueurs.length;
    }

    let lecture = 0;
    async function chargerJoueurs() {
      const demande = ++lecture;
      bouton.disabled = true;
      joueur.replaceChildren();
      message.textContent = '';
      try {
        const joueurs = await rpc('notes_five', { p_match: match.value });
        if (demande !== lecture) return;
        afficherJoueurs(joueurs);
        if (!joueurs.length) message.textContent = 'Tu as donné toutes tes notes pour ce Five.';
      } catch (erreur) {
        if (demande === lecture) message.textContent = erreur.message;
      }
    }

    match.addEventListener('change', chargerJoueurs);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (bouton.disabled) return;
      bouton.disabled = true;
      match.disabled = true;
      try {
        const reste = await rpc('notes_five', { p_match: match.value, p_joueur: joueur.value, p_note: note.valueAsNumber });
        afficherJoueurs(reste);
        note.value = '';
        message.textContent = 'Note enregistrée.';
      } catch (erreur) {
        message.textContent = erreur.message;
        bouton.disabled = false;
      } finally {
        match.disabled = false;
      }
    });
    await chargerJoueurs();
  } catch {
    message.textContent = 'Les notes sont temporairement indisponibles.';
  }
}

function lignesPodium(joueurs) {
  let rang = 0;
  return joueurs.map((joueur, index) => {
    if (!index || joueur.voix !== joueurs[index - 1].voix) rang = index + 1;
    const ligne = elementHistorique('li', '');
    ligne.className = rang === 1 ? 'podium-premier' : '';
    ligne.append(elementHistorique('span', String(rang)), elementHistorique('strong', joueur.prenom),
      elementHistorique('b', joueur.voix + ' voix'));
    return ligne;
  });
}

function afficherPodium(zone) {
  zone.innerHTML = `<label data-filtre hidden>Match<select></select></label>
    <p data-info role="status">Chargement…</p>
    <div data-podium hidden><div class="podium-horloge"><span data-legende></span>
    <strong data-valeur></strong><small data-date></small></div>
    <h2 data-titre></h2><ol class="podium-liste" data-rangs></ol><p data-vide></p></div>
    <details class="podium-cumul" open><summary>Votes cumulés</summary><ol class="podium-liste"></ol><p></p></details>`;
  const champ = zone.querySelector('select');
  const trouver = nom => zone.querySelector('[data-'+nom+']');
  const cumul = zone.querySelector('details');
  const format = new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Paris'});
  const libelle = m => format.format(new Date(m.debut)) + (m.lieu ? ' · '+m.lieu : '');
  let matchs = [], decalage = 0, enCours = false;
  function montrer() {
    const m = matchs.find(item=>item.id===champ.value);
    trouver('podium').hidden = !m;
    if (!m) return;
    const minutes = Math.max(0,Math.ceil((Date.parse(m.fin)-Date.now()-decalage)/60000));
    const gagnants = m.joueurs.filter(j=>j.voix===m.joueurs[0]?.voix);
    trouver('legende').textContent = minutes ? 'Fin des votes' : gagnants.length>1 ? 'Hommes du match · ex æquo' : gagnants.length ? 'Homme du match' : 'Vote terminé';
    trouver('valeur').textContent = minutes ? Math.floor(minutes/60)+' h '+String(minutes%60).padStart(2,'0')+' min'
      : gagnants.map(j=>j.prenom).join(' & ') || 'Aucun vote';
    trouver('date').textContent = libelle(m);
    trouver('titre').textContent = minutes ? 'Classement provisoire du match' : 'Classement final du match';
    trouver('rangs').replaceChildren(...lignesPodium(m.joueurs));
    trouver('vide').textContent = minutes && !m.joueurs.length ? 'En attente du premier vote.' : '';
  }
  async function actualiser() {
    if (enCours) return;
    enCours=true;
    try {
      await Promise.all([
        rpcHistorique('podium_matchs_five').then(data=>{
          const precedent=champ.value;
          matchs=data;
          if(data.length) decalage=Date.parse(data[0].serveur)-Date.now();
          if (JSON.stringify(data.map(libelle))!==champ.dataset.libelles || data.map(m=>m.id).join(',')!==champ.dataset.ids) {
            champ.replaceChildren(...data.map(m=>new Option(libelle(m),m.id)));
            champ.dataset.libelles=JSON.stringify(data.map(libelle));
            champ.dataset.ids=data.map(m=>m.id).join(',');
            if(data.some(m=>m.id===precedent)) champ.value=precedent;
          }
          trouver('filtre').hidden=data.length<2;
          trouver('info').textContent=data.length?'':'Le classement apparaîtra au premier coup d’envoi.';
          montrer();
        }).catch(()=>{trouver('info').textContent='Actualisation du match indisponible.';}),
        rpcHistorique('voix_homme_du_match').then(joueurs=>{
          cumul.querySelector('ol').replaceChildren(...lignesPodium(joueurs));
          cumul.querySelector('p').textContent=joueurs.length?'':'Aucune voix enregistrée.';
        }).catch(()=>{cumul.querySelector('p').textContent='Actualisation des votes cumulés indisponible.';})
      ]);
    } finally {enCours=false;}
  }
  champ.onchange=montrer;
  actualiser();
  const suivi=setInterval(()=>{if(!zone.isConnected) clearInterval(suivi); else if(!document.hidden) actualiser();},15000);
}

function initialiserHistoriqueFive() {
  const classement = document.querySelector('#historique-five');
  const cartons = document.querySelector('#cartons-five');
  const notes = document.querySelector('#notes-five');
  if (classement?.dataset.classement === 'homme-du-match') {
    afficherPodium(classement);
  } else if (classement) rpcHistorique('classements_five').then(data => afficherClassementReel(classement, data))
    .catch(() => { classement.textContent = 'Classement temporairement indisponible.'; });
  if (cartons) rpcHistorique('cartons_five').then(data => afficherCartonsReels(cartons, data))
    .catch(() => { cartons.textContent = 'Historique des cartons temporairement indisponible.'; });
  if (notes && !notes.dataset.initialise) {
    notes.dataset.initialise = 'true';
    afficherNotesFive(notes);
  }
}

initialiserHistoriqueFive();
window.addEventListener('hashchange', initialiserHistoriqueFive);
