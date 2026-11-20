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

function initialiserHistoriqueFive() {
  const classement = document.querySelector('#historique-five');
  const cartons = document.querySelector('#cartons-five');
  const notes = document.querySelector('#notes-five');
  if (classement) rpcHistorique('classements_five').then(data => afficherClassementReel(classement, data))
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
