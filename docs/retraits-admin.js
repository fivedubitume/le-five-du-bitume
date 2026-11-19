function afficherRetraitsAdmin(token) {
  const panneau = document.createElement('details');
  panneau.className = 'card section';
  panneau.innerHTML = '<summary>Numéros bloqués et retraits de matchs</summary><p role="status"></p><div></div>';
  const message = panneau.querySelector('p');
  const liste = panneau.querySelector('div');
  result.after(panneau);

  async function appeler(action, valeurs) {
    const reponse = await fetch(`${projectUrl}/rest/v1/rpc/${action}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(valeurs)
    });
    if (reponse.ok === false) {
      const erreur = await reponse.json().catch(() => null);
      throw new Error(erreur?.message || 'Action impossible.');
    }
    return reponse;
  }

  async function charger() {
    message.textContent = 'Chargement…';
    liste.replaceChildren();
    try {
      const reponse = await appeler('retraits_admin', {});
      const retraits = await reponse.json();
      message.textContent = retraits.length ? '' : 'Aucun numéro bloqué ni retrait à venir.';

      for (const retrait of retraits) {
        const ligne = document.createElement('div');
        ligne.className = 'row';
        const info = document.createElement('span');
        const blocage = retrait.type_retrait === 'numero';
        const dateMatch = retrait.match_date
          ? new Date(retrait.match_date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
          : '';
        const description = blocage ? 'Numéro bloqué' : `Retiré de ${retrait.match_titre} · ${dateMatch}`;
        info.textContent = `${retrait.prenom} · ${retrait.numero || 'Sans numéro'} · ${description}`;

        const bouton = document.createElement('button');
        bouton.type = 'button';
        bouton.className = 'btn alt';
        bouton.textContent = blocage ? 'Débloquer le numéro' : 'Autoriser à nouveau pour ce match';
        bouton.addEventListener('click', async () => {
          bouton.disabled = true;
          try {
            await appeler('retablir_acces_joueur', {
              p_type: retrait.type_retrait,
              p_numero: retrait.numero,
              p_match_id: retrait.match_id,
              p_player_id: retrait.player_id
            });
            await charger();
            message.textContent = 'Restriction levée. Le joueur peut réserver si aucune autre restriction ne s’applique.';
          } catch (erreur) {
            message.textContent = erreur.message;
            bouton.disabled = false;
          }
        });

        ligne.append(info, bouton);
        liste.append(ligne);
      }
    } catch (erreur) {
      message.textContent = erreur.message;
    }
  }

  panneau.addEventListener('toggle', () => {
    if (panneau.open) charger();
  });
}
