const clientVoteFive = window.supabase?.createClient(
  new URL(urlDisponibilites).origin, SUPABASE_KEY,
  { auth: { storageKey: 'bitume-session-joueur' } }
);

function initialiserVoteFive() {
  const carte = document.querySelector('#vote-five');
  if (!carte || carte.dataset.initialise) return;
  carte.dataset.initialise = 'true';

  const date = document.createElement('p');
  const compte = document.createElement('p');
  const action = document.createElement('button');
  action.type = 'button';
  action.className = 'btn';
  action.textContent = 'Voter';
  action.hidden = true;
  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  const choix = document.createElement('form');
  choix.hidden = true;
  const label = document.createElement('label');
  label.textContent = 'Choisis un joueur';
  const candidats = document.createElement('select');
  candidats.required = true;
  label.append(candidats);
  const envoyer = document.createElement('button');
  envoyer.className = 'btn';
  envoyer.textContent = 'Valider mon vote';
  choix.append(label, envoyer);
  carte.append(date, compte, action, choix, message);

  let match;
  let decalage = 0;
  let termine = false;

  function actualiserCompte() {
    if (!match) return;
    const maintenant = Date.now() + decalage;
    const attente = maintenant < Date.parse(match.debut);
    const cible = Date.parse(attente ? match.debut : match.cloture);
    const secondes = Math.max(0, Math.ceil((cible - maintenant) / 1000));
    const ouvert = !attente && secondes > 0;
    action.hidden = !ouvert || termine || !choix.hidden;
    if (!ouvert) choix.hidden = true;
    if (secondes === 0) {
      compte.textContent = 'Vote terminé';
      return;
    }
    const heures = Math.floor(secondes / 3600);
    const minutes = String(Math.floor(secondes / 60) % 60).padStart(2, '0');
    const reste = String(secondes % 60).padStart(2, '0');
    compte.textContent = `${attente ? 'Ouverture du vote' : 'Clôture du vote'} dans ${heures} h ${minutes} min ${reste} s`;
  }

  async function appeler(candidat = null) {
    const { data: { session }, error: erreurSession } = await clientVoteFive.auth.getSession();
    if (erreurSession) throw erreurSession;
    if (!session) throw new Error('Ouvre le site dans le navigateur utilisé pour réserver ta place.');
    const { data, error } = await clientVoteFive.rpc('vote_homme_du_match', {
      p_match_id: match.match_id, p_candidat_id: candidat
    });
    if (error) throw error;
    return data;
  }

  function afficherConfirmation(statut) {
    termine = true;
    choix.hidden = true;
    action.hidden = true;
    message.textContent = statut === 'enregistre' ? 'Ton vote est enregistré.' : 'Tu as déjà voté pour ce Five.';
  }

  action.addEventListener('click', async () => {
    action.disabled = true;
    message.textContent = '';
    try {
      const resultat = await appeler();
      if (resultat.statut === 'deja_vote') {
        afficherConfirmation(resultat.statut);
        return;
      }
      if (!resultat.candidats.length) {
        message.textContent = 'Aucun joueur disponible pour le vote.';
        return;
      }
      candidats.replaceChildren(new Option('Sélectionner un joueur', ''),
        ...resultat.candidats.map(joueur => new Option(joueur.prenom, joueur.id)));
      choix.hidden = false;
      actualiserCompte();
      if (!choix.hidden) candidats.focus();
    } catch (erreur) {
      message.textContent = erreur.message || 'Impossible d’ouvrir le vote.';
    } finally {
      action.disabled = false;
    }
  });

  choix.addEventListener('submit', async event => {
    event.preventDefault();
    envoyer.disabled = true;
    message.textContent = '';
    try {
      const resultat = await appeler(candidats.value);
      afficherConfirmation(resultat.statut);
    } catch (erreur) {
      message.textContent = erreur.message || 'Impossible d’enregistrer le vote.';
    } finally {
      envoyer.disabled = false;
    }
  });

  async function chargerCalendrier() {
    try {
      if (!clientVoteFive) throw new Error('Calendrier indisponible.');
      const { data, error } = await clientVoteFive.rpc('calendrier_vote_five');
      if (error) throw error;
      const prochain = data[0];
      if (prochain?.match_id !== match?.match_id) {
        termine = false;
        choix.hidden = true;
        message.textContent = '';
      }
      match = prochain;
      if (!match) {
        date.textContent = 'Aucun Five publié.';
        compte.textContent = '';
        action.hidden = true;
        return;
      }
      decalage = Date.parse(match.heure_serveur) - Date.now();
      date.textContent = new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
      }).format(new Date(match.debut));
      actualiserCompte();
    } catch {
      if (!match) date.textContent = 'Calendrier du vote indisponible.';
    }
  }

  chargerCalendrier();
  const horloge = setInterval(() => {
    if (!carte.isConnected) {
      clearInterval(horloge);
      clearInterval(calendrier);
      return;
    }
    actualiserCompte();
  }, 1000);
  const calendrier = setInterval(chargerCalendrier, 60000);
}

initialiserVoteFive();
window.addEventListener('hashchange', initialiserVoteFive);
window.addEventListener('pageshow', initialiserVoteFive);
