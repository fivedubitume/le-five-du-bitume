const inscription = document.querySelector('#joueur-inscription');
const message = document.querySelector('#joueur-message');
const section = document.querySelector('#joueur-matchs');
const liste = document.querySelector('#joueur-liste');
const valider = inscription.querySelector('button');
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
  const choixMaillot = inscription.querySelector('#choix-maillot');
  const champEquipe = inscription.elements.equipe;
  const suggestions = inscription.querySelector('#suggestions-maillots');
  let equipeChoisie = null;
  champEquipe.addEventListener('input', async () => {
    equipeChoisie = null;
    const saisie = champEquipe.value;
    suggestions.replaceChildren();
    if (saisie.trim().length < 2) return;
    try {
      const equipes = await catalogueMaillots.charger();
      if (champEquipe.value !== saisie || choixMaillot.hidden) return;
      const resultats = catalogueMaillots.chercher(equipes, saisie);
      if (!resultats.length) suggestions.textContent = 'Aucun maillot trouvé. Le maillot du Bitume sera utilisé.';
      for (const equipe of resultats) {
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'btn alt';
        bouton.textContent = equipe.label;
        bouton.addEventListener('click', () => {
          equipeChoisie = equipe;
          champEquipe.value = equipe.label;
          suggestions.replaceChildren();
          champEquipe.focus();
        });
        suggestions.append(bouton);
      }
    } catch {
      suggestions.textContent = 'Catalogue indisponible. Tu peux quand même réserver.';
    }
  });

  let profil = null;
  let ficheBloquee = false;
  let selection = null;
  const parametres = new URLSearchParams(location.search);
  let retraitDirect = parametres.get("retrait") === "1";
  const matchDemande = parametres.get("match");
  const boutonsMatchs = new Map();

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
    inscription.reset();
    equipeChoisie = null;
    suggestions.replaceChildren();
    choixMaillot.hidden = retraitDirect;
    choixMaillot.disabled = retraitDirect;
    inscription.elements.prenom.value = "";
    inscription.elements.telephone.value = "";
    inscription.elements.prenom.readOnly = false;
    inscription.elements.telephone.readOnly = false;




    valider.textContent = retraitDirect ? "Confirmer le retrait" : "Je m’engage à venir au match";
    message.textContent = "Renseigne ton prénom et ton numéro.";
    afficherTerrainFive(document.querySelector("#terrain-five-joueur"), match.venue);
    section.hidden = true;
    inscription.hidden = false;
    inscription.elements.prenom.focus();

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
    boutonsMatchs.clear();
    if (matchs.length === 0) liste.textContent = 'Aucun match à venir.';
    for (const match of matchs) {
      const ligne = document.createElement('div');
      ligne.className = 'row';
      const infos = document.createElement('span');
      const statut = match.reservations?.[0]?.status;
      infos.textContent = [
        match.title || 'Prochain Five',
        date.format(new Date(match.starts_at)),
        typeof match.price_cents === 'number' ? prix.format(match.price_cents / 100) : '',
        parMatch.has(match.id) ? textePlaces(parMatch.get(match.id)) : '',
        statut === 'confirmed' ? 'Place réservée' : statut === 'waitlist' ? 'En liste d’attente' : ''
      ].filter(Boolean).join(' · ');

      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btn';
      bouton.textContent = "Je prends ma place";
      bouton.addEventListener('click', () => ouvrirFormulaire(match));
      boutonsMatchs.set(match.id, bouton);
      const lieu = document.createElement("div");
      lieu.className = "terrain-five";
      afficherTerrainFive(lieu, match.venue);
      ligne.append(infos, lieu, bouton);
      liste.append(ligne);
    }
    section.hidden = false;
  }

  inscription.addEventListener('submit', async event => {
    event.preventDefault();
    if (selection === null) return;
    const match = selection;
    const numero = normaliserTelephoneFive(inscription.elements.telephone.value);
    const numeroDifferent = Boolean(profil && numero !== normaliserTelephoneFive(profil.phone));
    const nouveauNumeroPourReservation = retraitDirect === false && numeroDifferent;

    if (retraitDirect && numeroDifferent) {
      message.textContent = "Ce numéro ne correspond pas à ta réservation.";
      return;
    }

    const statut = nouveauNumeroPourReservation
      ? undefined
      : match.reservations?.[0]?.status;
    if (retraitDirect) {
      if (profil === null) {
        message.textContent = "Ouvre la page dans le navigateur utilisé pour réserver.";
        return;
      }
      const prenomSaisi = inscription.elements.prenom.value.trim();
      if (prenomSaisi.localeCompare(profil.first_name, "fr", { sensitivity: "base" }) === 0) {
        if (statut === undefined) {
          message.textContent = "Tu n’as pas de réservation pour ce match.";
          return;
        }
      } else {
        message.textContent = "Ce prénom ne correspond pas à ta fiche.";
        return;
      }
    }
    let actionTerminee = false;
    valider.disabled = true;
    message.textContent = 'Mise à jour en cours…';

    try {
      let reservation;
      if (retraitDirect) {
        reservation = await client.rpc('liberer_match', { p_match_id: match.id });
      } else {
        const prenom = inscription.elements.prenom.value.trim();
        const {data: {session}, error} = await client.auth.getSession();
        if (error) throw error;
        if (!session) {
          const connexion = await client.auth.signInAnonymously();
          if (connexion.error) throw connexion.error;
        }
        const reserver = () => client.rpc('inscrire_fiche_five', {
          p_match: match.id, p_prenom: prenom, p_telephone: numero, p_equipe: equipeChoisie?.id ?? null
        });
        reservation = await reserver();
        if (!reservation.error && reservation.data === 'nouvelle_fiche') {
          if (nouveauNumeroPourReservation) {
            const connexion = await client.auth.signInAnonymously();
            if (connexion.error) throw connexion.error;
            profil = null;
          }
          const creation = await client.rpc('creer_profil_joueur', {p_prenom: prenom,p_telephone: numero});
          reservation = await reserver();
          if (reservation.data === 'nouvelle_fiche')
            throw creation.error || new Error('Impossible de créer la fiche joueur.');
          profil = await lireProfil();
        }
      }
      if (reservation.error) throw reservation.error;
      const { data } = reservation;
      const retrait = retraitDirect;
      if (!retrait && !['confirmed','deja_confirme','waitlist'].includes(data))
        throw new Error('Réservation non confirmée. Vérifie ta place sur la feuille du match.');
      actionTerminee = true;
      retraitDirect = false;

      inscription.hidden = true;
      selection = null;
      message.textContent = retrait ? 'Inscription retirée.'
        : data === 'deja_confirme' ? 'Tu as déjà une place confirmée pour ce Five.'
        : data === 'confirmed' ? 'Inscription validée. Retour à l’accueil…' : 'Tu es en liste d’attente.';
      if ('BroadcastChannel' in window) {
        const canal = new BroadcastChannel('bitume-matchs');
        canal.postMessage('actualiser');
        canal.close();
      }
      if (!retrait && ['confirmed','deja_confirme'].includes(data)) {
        setTimeout(() => location.assign('index.html'), 1400);
        return;
      }
      await chargerMatchs();
    } catch (erreur) {
      message.textContent = actionTerminee
        ? 'Action enregistrée. Actualise la page pour voir la liste à jour.'
        : erreur.message || 'Impossible de mettre à jour ton inscription.';
    } finally {
      valider.disabled = false;
    }
  });

  (async () => {
    profil = await lireProfil();
    message.textContent = "";
    await chargerMatchs();
    if (matchDemande) {
      const bouton = boutonsMatchs.get(matchDemande);
      if (bouton) bouton.click();
      else message.textContent = 'Ce Five n’est plus disponible. Tu peux choisir un autre match.';
    } else if (retraitDirect) liste.querySelector("button")?.click();
  })().catch(erreur => {
    message.textContent = erreur.message || 'Impossible de charger les matchs.';
  });
}
