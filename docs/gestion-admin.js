function afficherGestionAdmin(token) {
  if (document.querySelector('#gestion-admin')) return;

  const panneau = document.createElement('section');
  panneau.id = 'gestion-admin';
  panneau.className = 'card section';
  panneau.innerHTML = `
    <h2>Gestion des joueurs</h2>
    <label>Rechercher par prénom ou numéro
      <input type="search" placeholder="Prénom ou numéro">
    </label>
    <p role="status"></p>
    <div class="grid"></div>
  `;
  result.after(panneau);

  const recherche = panneau.querySelector('input');
  const message = panneau.querySelector('[role="status"]');
  const liste = panneau.querySelector('.grid');
  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris'
  });
  const urls = `${projectUrl}/rest/v1/rpc/gestion_joueurs_admin`;
  let joueurs = [];
  let modificationEnCours = false;

  async function appeler(action, options = {}) {
    const reponse = await fetch(urls, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_action: action, ...options })
    });
    const donnees = await reponse.json().catch(() => null);
    if (reponse.ok === false) {
      throw new Error(donnees?.message || `Action impossible (${reponse.status}).`);
    }
    return donnees;
  }

  function texte(balise, valeur) {
    const element = document.createElement(balise);
    element.textContent = valeur;
    return element;
  }

  function bouton(label, action) {
    const element = texte('button', label);
    element.type = 'button';
    element.className = 'btn alt';
    element.addEventListener('click', action);
    return element;
  }

  async function modifier(action, joueur, options = {}) {
    if (modificationEnCours) return;
    modificationEnCours = true;
    message.textContent = 'Enregistrement…';

    try {
      const retour = await appeler(action, { p_player_id: joueur.id, ...options });
      joueurs = await appeler('liste');
      afficher();
      message.textContent = retour.statut === 'waitlist'
        ? 'Joueur remis en liste d’attente. Le match est complet.'
        : retour.statut === 'confirmed'
          ? 'Joueur remis dans le match. Sa place est confirmée.'
          : 'Modification enregistrée.';

      if (['retirer_match', 'remettre_match', 'bloquer'].includes(action)) {
        await afficherMatchsReels(token);
        if ('BroadcastChannel' in window) {
          const canal = new BroadcastChannel('bitume-matchs');
          canal.postMessage('actualiser');
          canal.close();
        }
      }
    } catch (erreur) {
      message.textContent = erreur.message;
    } finally {
      modificationEnCours = false;
    }
  }

  function afficher() {
    const filtre = recherche.value.trim().toLocaleLowerCase('fr');
    const chiffres = filtre.replace(/\D/g, '').replace(/^0033|^33|^0/, '');
    liste.replaceChildren();

    for (const joueur of joueurs) {
      const numero = joueur.numero || '';
      const parPrenom = joueur.prenom.toLocaleLowerCase('fr').includes(filtre);
      const parNumero = chiffres.length > 0 && numero.replace(/\D/g, '').includes(chiffres);
      if (filtre && parPrenom === false && parNumero === false) continue;

      const fiche = document.createElement('article');
      fiche.className = 'card';
      const statut = joueur.bloque ? 'Numéro bloqué' : 'Accès actif';
      const carton = joueur.carton
        ? `Carton ${joueur.carton}${joueur.motif ? ` · ${joueur.motif}` : ''}`
        : 'Aucun carton';
      fiche.append(
        texte('h3', joueur.prenom),
        texte('p', `${numero || 'Numéro non renseigné'} · ${statut}`),
        texte('p', carton)
      );

      const discipline = document.createElement('div');
      discipline.className = 'actions';
      for (const couleur of ['blanc', 'jaune', 'rouge']) {
        discipline.append(bouton(`Carton ${couleur}`, () => {
          const motif = window.prompt(`Motif du carton ${couleur}`, '');
          if (motif === null) return;
          modifier('carton', joueur, { p_couleur: couleur, p_motif: motif });
        }));
      }
      if (joueur.carton) {
        discipline.append(bouton('Enlever le carton', () => modifier('enlever_carton', joueur)));
      }
      fiche.append(discipline);

      if (numero) {
        fiche.append(bouton(joueur.bloque ? 'Réactiver le numéro' : 'Bloquer pour tous les matchs', () => {
          if (joueur.bloque) {
            modifier('reactiver', joueur);
          } else if (window.confirm(`Bloquer ${joueur.prenom} et retirer ses inscriptions à venir ?`)) {
            modifier('bloquer', joueur);
          }
        }));
      }

      fiche.append(texte('h4', 'Matchs à venir'));
      if (joueur.matchs.length === 0) {
        fiche.append(texte('p', 'Aucune inscription ni aucun retrait à venir.'));
      }

      for (const match of joueur.matchs) {
        const ligne = document.createElement('div');
        ligne.className = 'row';
        const retire = match.statut === 'retire';
        const statutMatch = retire ? 'Retiré' : match.statut === 'confirmed' ? 'Confirmé' : 'En attente';
        ligne.append(texte('span', `${match.titre} · ${date.format(new Date(match.debut))} · ${statutMatch}`));
        ligne.append(bouton(retire ? 'Remettre dans ce match' : 'Retirer de ce match', () => {
          modifier(retire ? 'remettre_match' : 'retirer_match', joueur, { p_match_id: match.id });
        }));
        fiche.append(ligne);
      }
      liste.append(fiche);
    }

    if (liste.childElementCount === 0) {
      liste.append(texte('p', 'Aucun joueur trouvé.'));
    }
  }

  recherche.addEventListener('input', afficher);
  message.textContent = 'Chargement des joueurs…';
  appeler('liste').then(donnees => {
    joueurs = donnees;
    afficher();
    message.textContent = '';
  }).catch(erreur => { message.textContent = erreur.message; });
}
