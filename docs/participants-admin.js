function ajouterParticipantsAdmin(ligne, match, token) {
  const panneau = document.createElement('details');
  const titre = document.createElement('summary');
  const contenu = document.createElement('div');
  const entetes = { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` };
  titre.textContent = 'Participants';
  panneau.append(titre, contenu);
  ligne.append(panneau);

  async function appeler(action, donnees) {
    const response = await fetch(`${projectUrl}/rest/v1/rpc/${action}`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify(donnees)
    });
    if (response.ok === false) {
      const erreur = await response.json().catch(() => null);
      throw new Error(erreur?.message || `Action refusée (${response.status}).`);
    }
    return response;
  }

  panneau.addEventListener('toggle', async () => {
    if (panneau.open === false) return;
    contenu.textContent = 'Chargement des participants…';

    try {
      const response = await appeler('participants_match', { p_match_id: match.id });
      const participants = await response.json();
      contenu.replaceChildren();
      if (participants.length === 0) contenu.textContent = 'Aucun inscrit.';

      for (const participant of participants) {
        const entree = document.createElement('div');
        entree.className = 'row';
        const infos = document.createElement('span');
        const statut = participant.status === 'confirmed' ? 'Confirmé' : 'En attente';
        infos.textContent = `${participant.first_name} · ${participant.phone || 'Numéro non renseigné'} · ${statut}`;
        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'btn alt';
        bouton.textContent = 'Retirer de ce match';
        const retour = document.createElement('span');
        retour.setAttribute('role', 'status');

        bouton.addEventListener('click', async () => {
          if (window.confirm(`Retirer ${participant.first_name} de ce match ?`) === false) return;
          bouton.disabled = true;
          try {
            await appeler('retirer_participant', {
              p_match_id: match.id,
              p_player_id: participant.player_id
            });
            await afficherMatchsReels(token);
            if ('BroadcastChannel' in window) {
              const canal = new BroadcastChannel('bitume-matchs');
              canal.postMessage('actualiser');
              canal.close();
            }
          } catch (erreur) {
            retour.textContent = erreur.message || 'Retrait impossible.';
            bouton.disabled = false;
          }
        });

        entree.append(infos, bouton);
        ajouterBlocageNumero(entree, participant, appeler, token);
        entree.append(retour);
        contenu.append(entree);
      }
    } catch (erreur) {
      contenu.textContent = erreur.message || 'Impossible de charger les participants.';
    }
  });
}

function ajouterBlocageNumero(entree, participant, appeler, token) {
  if (participant.phone === null) return;
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'btn alt';
  bouton.textContent = 'Retirer définitivement';
  const retour = document.createElement('span');
  retour.setAttribute('role', 'status');
  entree.append(bouton, retour);

  bouton.addEventListener('click', async () => {
    const confirmation = `Bloquer le numéro de ${participant.first_name} ? Ses inscriptions à venir seront retirées.`;
    if (window.confirm(confirmation) === false) return;
    bouton.disabled = true;
    try {
      await appeler('bloquer_numero_joueur', { p_player_id: participant.player_id });
      if ('BroadcastChannel' in window) {
        const canal = new BroadcastChannel('bitume-matchs');
        canal.postMessage('actualiser');
        canal.close();
      }
      await afficherMatchsReels(token);
    } catch (erreur) {
      retour.textContent = erreur.message || 'Blocage impossible.';
      bouton.disabled = false;
    }
  });
}
