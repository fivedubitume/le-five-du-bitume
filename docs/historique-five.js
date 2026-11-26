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

function afficherClassementReel(zone, joueurs) {
  zone.replaceChildren(elementHistorique('p', 'Victoire · 3 pts　 Nul · 1 pt　 Défaite · 0 pt'));
  if (!joueurs.length) zone.append(elementHistorique('p', 'En attente du premier résultat.'));
  let rang = 0;
  joueurs.forEach((joueur, index) => {
    if (!index || joueur.points !== joueurs[index - 1].points) rang = index + 1;
    const ligne = document.createElement('div');
    ligne.className = 'row';
    ligne.append(elementHistorique('span', rang + '. ' + joueur.prenom),
      elementHistorique('strong', joueur.points + (joueur.points > 1 ? ' pts' : ' pt')));
    zone.append(ligne);
  });
}

function afficherCartonsReels(zone, cartons) {
  zone.replaceChildren();
  for (const couleur of ['blanc','jaune','rouge']) {
    const colonne = document.createElement('section');
    colonne.className = 'col-carton ' + couleur;
    colonne.append(elementHistorique('h2', couleur[0].toUpperCase()+couleur.slice(1)));
    const sanctions = cartons.filter(c => c.couleur === couleur);
    for (const c of sanctions) {
      const fiche = document.createElement('article');
      fiche.append(elementHistorique('strong',c.prenom),elementHistorique('p',c.motif || 'Motif non renseigné'),
        elementHistorique('small',dateHistorique.format(new Date(c.date_match))));
      colonne.append(fiche);
    }
    if (!sanctions.length) colonne.append(elementHistorique('small','Aucun carton'));
    zone.append(colonne);
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
  const definitif = zone.dataset.classement === 'palmares';
  zone.innerHTML = '<select aria-label="Choisir le match" hidden></select><p role="status"></p><ol class="podium-liste"></ol>';
  const choix = zone.querySelector('select');
  const info = zone.querySelector('p');
  const liste = zone.querySelector('ol');
  let matchs = [], decalage = 0, occupe = false;
  function afficher() {
    const precedent = choix.value;
    const ouverts = matchs.filter(m => Date.parse(m.fin) > Date.now() + decalage);
    choix.replaceChildren(...ouverts.map(m => new Option(new Date(m.debut).toLocaleString('fr-FR',
      {dateStyle:'short',timeStyle:'short',timeZone:'Europe/Paris'}) + ' · ' + m.lieu, m.id)));
    if (ouverts.some(m => m.id === precedent)) choix.value = precedent;
    choix.hidden = ouverts.length < 2;
    const m = ouverts.find(item => item.id === choix.value);
    liste.replaceChildren(...lignesPodium(m?.joueurs || []));
    if (!m) { info.textContent = 'Aucun vote en cours.'; return; }
    const minutes = Math.ceil((Date.parse(m.fin) - Date.now() - decalage) / 60000);
    info.textContent = 'Homme du match · ' + choix.selectedOptions[0].text + ' · Fin des votes dans ' +
      Math.floor(minutes/60) + ' h ' + minutes%60 + ' min' + (m.joueurs.length ? '' : ' · En attente du premier vote.');
  }
  async function charger() {
    if (occupe) return;
    occupe = true;
    try {
      if (definitif) {
        const joueurs = await rpcHistorique('palmares_hdm');
        let rang = 0;
        liste.replaceChildren(...joueurs.map((j,i) => {
          if (!i || j.points !== joueurs[i-1].points) rang = i+1;
          const ligne = document.createElement('li');
          if (rang === 1) ligne.className = 'podium-premier';
          ligne.append(elementHistorique('span',String(rang)), elementHistorique('strong',j.prenom),
            elementHistorique('b',j.points + (j.points > 1 ? ' points' : ' point')));
          return ligne;
        }));
        info.textContent = joueurs.length ? '1 élection = 1 point' : 'Aucun homme du match élu pour le moment.';
      } else {
        matchs = await rpcHistorique('podium_matchs_five');
        if (matchs.length) decalage = Date.parse(matchs[0].serveur)-Date.now();
        afficher();
      }
    } catch { info.textContent = 'Classement temporairement indisponible.'; }
    finally { occupe = false; }
  }
  choix.onchange = afficher;
  charger();
  const suivi = setInterval(() => {
    if (!zone.isConnected) clearInterval(suivi);
    else if (!document.hidden) charger();
  },10000);
}

function initialiserHistoriqueFive() {
  const classement = document.querySelector('#historique-five');
  const cartons = document.querySelector('#cartons-five');
  const notes = document.querySelector('#notes-five');
  if (['homme-du-match','palmares'].includes(classement?.dataset.classement)) {
    afficherPodium(classement);
  } else if (classement) rpcHistorique('points_resultats_five').then(data => afficherClassementReel(classement, data))
    .catch(() => { classement.textContent = 'Classement temporairement indisponible.'; });
  if (cartons) rpcHistorique('cartons_avec_motif').then(data => afficherCartonsReels(cartons, data))
    .catch(() => { cartons.textContent = 'Historique des cartons temporairement indisponible.'; });
  if (notes && !notes.dataset.initialise) {
    notes.dataset.initialise = 'true';
    afficherNotesFive(notes);
  }
}

initialiserHistoriqueFive();
window.addEventListener('hashchange', initialiserHistoriqueFive);
