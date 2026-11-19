const inscription = document.querySelector('#joueur-inscription');
const message = document.querySelector('#joueur-message');
const section = document.querySelector('#joueur-matchs');
const liste = document.querySelector('#joueur-liste');
const boutonInscription = inscription.querySelector('button');

if (window.supabase) {
  demarrerJoueur();
} else {
  message.textContent = 'Le service de connexion ne se charge pas. Actualise la page.';
}

function demarrerJoueur() {
  const client = window.supabase.createClient(new URL(urlDisponibilites).origin, SUPABASE_KEY, {
    auth: { storageKey: 'bitume-session-joueur' }
  });
  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
  });
  const prix = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

  async function chargerMatchs() {
    const { data, error } = await client.from('matches')
      .select('id,title,starts_at,venue,price_cents,reservations(status)')
      .gt('starts_at', new Date().toISOString()).order('starts_at');
    if (error) throw error;

    const disponibilites = new Map(
      (await lireDisponibilites().catch(() => [])).map(m => [m.id, m.places_restantes])
    );
    liste.replaceChildren();
    if (data.length === 0) liste.textContent = 'Aucun match à venir.';

    for (const match of data) {
      const ligne = document.createElement('div');
      ligne.className = 'row';
      const infos = document.createElement('span');
      infos.textContent = [
        match.title, date.format(new Date(match.starts_at)), match.venue,
        prix.format(match.price_cents / 100),
        disponibilites.has(match.id)
          ? textePlaces(disponibilites.get(match.id))
          : 'Places temporairement indisponibles'
      ].join(' · ');

      const statut = match.reservations?.[0]?.status;
      const bouton = document.createElement('button');
      bouton.type = 'button';
      bouton.className = 'btn';
      bouton.textContent = statut === 'confirmed' ? 'Libérer ma place'
        : statut === 'waitlist' ? 'Quitter la liste d’attente' : 'Je prends ma place';

      bouton.addEventListener('click', async () => {
        bouton.disabled = true;
        message.textContent = 'Mise à jour en cours…';

        try {
          const { data: resultat, error } = await client.rpc(
            statut ? 'liberer_match' : 'reserver_match', { p_match_id: match.id }
          );
          if (error) throw error;

          message.textContent = statut ? 'Inscription retirée.'
            : resultat === 'confirmed' ? 'Ta place est réservée.' : 'Tu es en liste d’attente.';
          await chargerMatchs();
          if ('BroadcastChannel' in window) {
            const canal = new BroadcastChannel('bitume-matchs');
            canal.postMessage('actualiser');
            canal.close();
          }
        } catch (erreur) {
          message.textContent = erreur.message || 'La mise à jour a échoué.';
          bouton.disabled = false;
        }
      });

      if (statut) {
        const etat = document.createElement('strong');
        etat.textContent = statut === 'confirmed' ? 'Place réservée' : 'En liste d’attente';
        ligne.append(infos, etat, bouton);
      } else {
        ligne.append(infos, bouton);
      }
      liste.append(ligne);
    }
    section.hidden = false;
  }

  async function afficherEspace() {
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    if (session) {
      const { data: profil, error: erreurProfil } = await client.from('profiles')
        .select('first_name,phone,role').eq('id', session.user.id).maybeSingle();
      if (erreurProfil) throw erreurProfil;
      if (profil?.role === 'player' && profil.phone) {
        inscription.hidden = true;
        message.textContent = `Bienvenue ${profil.first_name}.`;
        await chargerMatchs();
        return;
      }
    }
    inscription.hidden = false;
    message.textContent = '';
  }

  inscription.addEventListener('submit', async event => {
    event.preventDefault();
    boutonInscription.disabled = true;
    message.textContent = 'Création de ta fiche…';
    const champs = new FormData(inscription);

    try {
      const { data: { session }, error: erreurSession } = await client.auth.getSession();
      if (erreurSession) throw erreurSession;
      if (session === null) {
        const { error } = await client.auth.signInAnonymously();
        if (error) throw error;
      }

      const { error } = await client.rpc('creer_profil_joueur', {
        p_prenom: champs.get('prenom'),
        p_telephone: champs.get('telephone')
      });
      if (error) throw error;
      inscription.reset();
      await afficherEspace();
    } catch (erreur) {
      message.textContent = erreur.message || 'Inscription impossible.';
    } finally {
      boutonInscription.disabled = false;
    }
  });

  afficherEspace().catch(erreur => {
    message.textContent = erreur.message || 'Impossible d’ouvrir l’espace joueur.';
  });
}
