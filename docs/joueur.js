const inscription = document.querySelector('#joueur-inscription');
const message = document.querySelector('#joueur-message');
const section = document.querySelector('#joueur-matchs');
const liste = document.querySelector('#joueur-liste');
const valider = inscription.querySelector('button');
const boutonFermer = document.createElement('button');
boutonFermer.type = 'button';
boutonFermer.className = 'btn alt';
boutonFermer.textContent = 'Retour aux matchs';
inscription.append(boutonFermer);

if (window.supabase) {
  demarrerJoueur();
} else {
  message.textContent = 'La connexion ne se charge pas. Actualise la page.';
}

function demarrerJoueur() {
  const client = window.supabase.createClient(new URL(urlDisponibilites).origin, SUPABASE_KEY, {
    auth: { storageKey: 'bitume-session-joueur' }
  });
  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
  });
  const prix = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
  let profil = null;
  let ficheBloquee = false;
  let selection = null;

  async function lireProfil() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    ficheBloquee = false;
    if (session === null) return null;
    const { data: bloque, error: erreurBlocage } = await client.rpc("mon_numero_est_bloque");
    if (erreurBlocage) throw erreurBlocage;
    ficheBloquee = bloque === true;
    if (ficheBloquee) return null;
    const { data, error: erreurProfil } = await client.from('profiles')
      .select('first_name,phone,role').eq('id', session.user.id).maybeSingle();
    if (erreurProfil) throw erreurProfil;
    return data?.role === 'player' && data.phone ? data : null;
  }

  function ouvrirFormulaire(match) {
    selection = match;
    const statut = match.reservations?.[0]?.status;
    inscription.elements.prenom.value = profil?.first_name || '';
    inscription.elements.telephone.value = profil?.phone || '';
    inscription.elements.prenom.readOnly = Boolean(profil);
    inscription.elements.telephone.readOnly = Boolean(profil);
    valider.textContent = statut
      ? (statut === 'confirmed' ? 'Libérer ma place' : 'Quitter la liste d’attente')
      : 'Confirmer mon inscription';
    message.textContent = statut === 'confirmed' ? 'Tu es déjà inscrit à ce match.'
      : statut === 'waitlist' ? 'Tu es déjà en liste d’attente.' : 'Renseigne tes coordonnées pour réserver.';
    section.hidden = true;
    inscription.hidden = false;
    if (profil === null) inscription.elements.prenom.focus();
    else valider.focus();
  }

  async function chargerMatchs() {
    const disponibilites = await lireDisponibilites(profil === null);
    const parMatch = new Map(disponibilites.map(match => [match.id, match.places_restantes]));
    let matchs = disponibilites;
    if (profil) {
      const { data, error } = await client.from('matches')
        .select('id,title,starts_at,venue,price_cents,reservations(status)')
        .gt('starts_at', new Date().toISOString()).order('starts_at');
      if (error) throw error;
      matchs = data;
    }

    liste.replaceChildren();
    if (matchs.length === 0) liste.textContent = 'Aucun match à venir.';
    for (const match of matchs) {
      const ligne = document.createElement('div');
      ligne.className = 'row';
      const infos = document.createElement('span');
      const statut = match.reservations?.[0]?.status;
      infos.textContent = [
        match.title || 'Prochain Five',
        date.format(new Date(match.starts_at)),
        match.venue,
        typeof match.price_cents === 'number' ? prix.format(match.price_cents / 100) : '',
        parMatch.has(match.id) ? textePlaces(parMatch.get(match.id)) : '',
        statut === 'confirmed' ? 'Place réservée' : statut === 'waitlist' ? 'En liste d’attente' : ''
      ].filter(Boolean).join(' · ');

      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btn';
      bouton.textContent = statut ? 'Gérer ma place' : 'Je prends ma place';
      bouton.addEventListener('click', () => ouvrirFormulaire(match));
      ligne.append(infos, bouton);
      liste.append(ligne);
    }
    section.hidden = false;
  }

  boutonFermer.addEventListener('click', () => {
    selection = null;
    inscription.hidden = true;
    section.hidden = false;
    message.textContent = '';
  });

  inscription.addEventListener('submit', async event => {
    event.preventDefault();
    if (selection === null) return;
    const match = selection;
    const statut = match.reservations?.[0]?.status;
    let actionTerminee = false;
    valider.disabled = true;
    boutonFermer.disabled = true;
    message.textContent = 'Mise à jour en cours…';

    try {
      if (profil === null) {
        const champs = new FormData(inscription);
        const { data: { session }, error } = await client.auth.getSession();
        if (error) throw error;
        if (session === null || ficheBloquee) {
          const { error: erreurConnexion } = await client.auth.signInAnonymously();
          if (erreurConnexion) throw erreurConnexion;
          ficheBloquee = false;
        }

        const { error: erreurProfil } = await client.rpc('creer_profil_joueur', {
          p_prenom: champs.get('prenom'),
          p_telephone: champs.get('telephone')
        });
        if (erreurProfil) throw erreurProfil;
        profil = await lireProfil();
        if (profil === null) throw new Error('Fiche joueur introuvable.');
        inscription.elements.prenom.readOnly = true;
        inscription.elements.telephone.readOnly = true;
      }

      const { data, error } = await client.rpc(
        statut ? 'liberer_match' : 'reserver_match', { p_match_id: match.id }
      );
      if (error) throw error;
      actionTerminee = true;

      inscription.hidden = true;
      selection = null;
      message.textContent = statut ? 'Inscription retirée.'
        : data === 'confirmed' ? 'Ta place est réservée.' : 'Tu es en liste d’attente.';
      if ('BroadcastChannel' in window) {
        const canal = new BroadcastChannel('bitume-matchs');
        canal.postMessage('actualiser');
        canal.close();
      }
      await chargerMatchs();
    } catch (erreur) {
      message.textContent = actionTerminee
        ? 'Action enregistrée. Actualise la page pour voir la liste à jour.'
        : erreur.message || 'Impossible de mettre à jour ton inscription.';
    } finally {
      valider.disabled = false;
      boutonFermer.disabled = false;
    }
  });

  (async () => {
    profil = await lireProfil();
    message.textContent = profil ? `Bienvenue ${profil.first_name}.` : '';
    await chargerMatchs();
  })().catch(erreur => {
    message.textContent = erreur.message || 'Impossible de charger les matchs.';
  });
}
