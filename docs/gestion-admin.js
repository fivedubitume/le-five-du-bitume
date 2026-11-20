function afficherGestionAdmin(token) {
  if (document.querySelector('#gestion-admin')) return;

  const panneau = document.createElement('section');
  panneau.id = 'gestion-admin';
  panneau.className = 'card section';
  panneau.innerHTML = `
    <h2>Gestion des matchs</h2>
    <div class="actions">
      <button class="btn alt" type="button" id="vue-matchs">Voir les archives</button>
      <button class="btn alt" type="button" id="archive-match" hidden></button>
    </div>
    <label for="choix-match">Match</label>
    <select id="choix-match"></select>
    <p role="status" aria-live="polite"></p>
    <div id="lignes-joueurs"></div>
    <div id="resultat-five-admin" class="section"></div>
    <details class="section">
      <summary>Historique des cartons par Five</summary>
      <div id="cartons-five-admin"></div>
    </details>

    <details class="section">
      <summary>Numéros bloqués</summary>
      <form class="actions" id="blocage-numero">
        <label>Numéro à bloquer
          <input type="tel" name="numero" autocomplete="off" required>
        </label>
        <button class="btn alt" type="submit">Bloquer pour tous les matchs</button>
      </form>
      <div id="liste-bloques"></div>
    </details>

    <details class="section">
      <summary>Joueurs sanctionnés</summary>
      <div id="liste-sanctions"></div>
    </details>
  `;
  result.after(panneau);

  const choix = panneau.querySelector('#choix-match');
  const vue = panneau.querySelector('#vue-matchs');
  const archive = panneau.querySelector('#archive-match');
  const liste = panneau.querySelector('#lignes-joueurs');
  const espaceResultat = panneau.querySelector('#resultat-five-admin');
  const historiqueCartons = panneau.querySelector('#cartons-five-admin');
  const bloques = panneau.querySelector('#liste-bloques');
  const sanctions = panneau.querySelector('#liste-sanctions');
  const message = panneau.querySelector('[role="status"]');
  const formulaire = panneau.querySelector('#blocage-numero');
  const date = new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris'
  });

  let afficherArchives = false;
  let enCours = false;
  let lecture = 0;
  let matchs = [];

  async function appeler(action, options = {}, fonction = 'tableau_matchs_admin') {
    const reponse = await fetch(`${projectUrl}/rest/v1/rpc/${fonction}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_action: action, ...options })
    });

    const contenu = await reponse.json().catch(() => null);
    if (reponse.ok === false) {
      throw new Error(contenu?.message || `Action impossible (${reponse.status}).`);
    }
    return contenu;
  }

  function texte(balise, valeur) {
    const noeud = document.createElement(balise);
    noeud.textContent = valeur;
    return noeud;
  }

  function bouton(label, action) {
    const noeud = texte('button', label);
    noeud.type = 'button';
    noeud.className = 'btn alt';
    noeud.addEventListener('click', action);
    return noeud;
  }

  function ligne() {
    const noeud = document.createElement('div');
    noeud.className = 'row';
    return noeud;
  }

  async function modifier(action, options, fonction = 'tableau_matchs_admin') {
    if (enCours) return false;
    enCours = true;
    message.textContent = 'Enregistrement…';
    let enregistre = false;

    try {
      const retour = await appeler(action, options, fonction);
      enregistre = true;

      if (['retirer_simple', 'bloquer_match', 'remettre_match', 'bloquer_numero'].includes(action)) {
        if ('BroadcastChannel' in window) {
          const canal = new BroadcastChannel('bitume-matchs');
          canal.postMessage('actualiser');
          canal.close();
        }
      }

      await charger();
      if (typeof afficherMatchsReels === 'function') await afficherMatchsReels(token);

      message.textContent = retour?.statut === 'waitlist'
        ? 'Joueur remis en liste d’attente.'
        : retour?.statut === 'confirmed'
          ? 'Joueur remis dans le match.'
          : 'Modification enregistrée.';
      return true;
    } catch (erreur) {
      message.textContent = enregistre
        ? 'Modification enregistrée. Actualise la page pour voir le tableau à jour.'
        : erreur.message;
      return enregistre;
    } finally {
      enCours = false;
    }
  }

  function modifierCarton(action, joueur) {
    const enlever = action === 'enlever_carton';
    const motif = enlever ? '' : window.prompt(`Motif du carton ${action}`, '');
    if (motif === null) return;

    modifier(
      enlever ? 'enlever_carton' : 'carton',
      {
        p_player_id: joueur.id,
        p_couleur: enlever ? null : action,
        p_motif: motif
      },
      'gestion_joueurs_admin'
    );
  }

  function actionsJoueur(joueur, match) {
    const actions = document.createElement('select');
    actions.setAttribute('aria-label', `Actions pour ${joueur.prenom}`);
    actions.style.width = 'auto';
    actions.style.maxWidth = '100%';
    actions.append(new Option('Actions…', ''));

    if (match.archived_admin === false && new Date(match.starts_at).getTime() > Date.now()) {
      if (joueur.statut === 'retire') {
        if (joueur.bloque === false) {
          actions.append(new Option('Remettre dans ce match', 'remettre_match'));
        }
      } else {
        actions.append(
          new Option('Retirer de ce match · réinscription possible', 'retirer_simple'),
          new Option('Bloquer pour ce match', 'bloquer_match')
        );
      }
    }

    if (joueur.numero) {
      actions.append(new Option(
        joueur.bloque ? 'Débloquer le numéro' : 'Bloquer pour tous les matchs',
        joueur.bloque ? 'debloquer_numero' : 'bloquer_numero'
      ));
    }

    actions.append(
      new Option('Carton blanc', 'blanc'),
      new Option('Carton jaune', 'jaune'),
      new Option('Carton rouge', 'rouge')
    );
    if (joueur.carton) actions.append(new Option('Enlever le carton', 'enlever_carton'));

    actions.addEventListener('change', () => {
      const action = actions.value;
      actions.value = '';
      if (action === '' || enCours) return;

      if (['blanc', 'jaune', 'rouge', 'enlever_carton'].includes(action)) {
        modifierCarton(action, joueur);
        return;
      }

      if (action === 'bloquer_numero' &&
          window.confirm(`Bloquer ${joueur.prenom} et retirer ses inscriptions à venir ?`) === false) return;

      modifier(action, {
        p_match_id: match.id,
        p_player_id: joueur.id,
        p_numero: joueur.numero
      });
    });

    return actions;
  }

  async function historiqueRpc(nom, donnees = {}, prive = true) {
    const reponse = await fetch(`${projectUrl}/rest/v1/rpc/${nom}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        ...(prive ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(donnees)
    });
    const data = await reponse.json();
    if (!reponse.ok) throw new Error(data.message || 'Données indisponibles.');
    return data;
  }

  function historiqueAction(action, match, data) {
    return historiqueRpc('historique_five_admin', {
      p_action: action, p_match: match, p_data: data
    });
  }

  async function chargerCartonsParFive() {
    const cartons = await historiqueRpc('cartons_five', {}, false);
    historiqueCartons.replaceChildren();
    if (!cartons.length) historiqueCartons.append(texte('p', 'Aucun carton par Five.'));
    for (const carton of cartons) {
      const entree = ligne();
      const retirer = bouton('Retirer ce carton', async () => {
        if (!window.confirm(`Retirer le carton ${carton.couleur} de ${carton.prenom} ?`)) return;
        retirer.disabled = true;
        try {
          await historiqueAction('retirer_carton', null, { id: carton.id });
          await chargerCartonsParFive();
        } catch (erreur) {
          afficherErreur(erreur);
        } finally {
          retirer.disabled = false;
        }
      });
      entree.append(texte('span',
        `${date.format(new Date(carton.date_match))} · ${carton.prenom} · ${carton.couleur}`), retirer);
      historiqueCartons.append(entree);
    }
  }

  function afficherResultatAdmin(match, joueurs, resultat) {
    const confirmes = joueurs.filter(joueur => joueur.statut === 'confirmed');
    if (!confirmes.length) return;

    const ajouterChamp = (form, titre, champ) => {
      const label = texte('label', titre);
      label.append(champ);
      form.append(label);
    };

    function formulaireHistorique(titre, libelle, enregistrer) {
      const form = document.createElement('form');
      form.className = 'card section';
      form.append(texte('h3', titre));
      const valider = texte('button', libelle);
      valider.className = 'btn';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        valider.disabled = true;
        try {
          await enregistrer();
          message.textContent = 'Enregistré.';
        } catch (erreur) {
          afficherErreur(erreur);
        } finally {
          valider.disabled = false;
        }
      });
      return { form, valider };
    }

    if (new Date(match.starts_at).getTime() <= Date.now()) {
      const equipes = new Map();
      const scores = ['A', 'B'].map((_, index) => {
        const input = document.createElement('input');
        Object.assign(input, { type: 'number', min: '0', max: '99', step: '1', required: true });
        input.value = index === 0 ? resultat?.score_a ?? '' : resultat?.score_b ?? '';
        return input;
      });
      const { form, valider } = formulaireHistorique('Équipes et score', 'Enregistrer le résultat', () => {
        const equipe = valeur => [...equipes].filter(([, champ]) => champ.value === valeur).map(([id]) => id);
        return historiqueAction('score', match.id, {
          score_a: scores[0].valueAsNumber, score_b: scores[1].valueAsNumber,
          equipe_a: equipe('A'), equipe_b: equipe('B')
        });
      });
      for (const joueur of confirmes) {
        const choixEquipe = document.createElement('select');
        choixEquipe.append(new Option('Non joué', ''), new Option('Équipe A', 'A'), new Option('Équipe B', 'B'));
        if (resultat?.equipe_a.includes(joueur.id)) choixEquipe.value = 'A';
        if (resultat?.equipe_b.includes(joueur.id)) choixEquipe.value = 'B';
        equipes.set(joueur.id, choixEquipe);
        ajouterChamp(form, joueur.prenom, choixEquipe);
      }
      ajouterChamp(form, 'Score de l’équipe A', scores[0]);
      ajouterChamp(form, 'Score de l’équipe B', scores[1]);
      form.append(valider);
      espaceResultat.append(form);
    }

    const joueur = document.createElement('select');
    joueur.append(...confirmes.map(item => new Option(item.prenom || 'Joueur', item.id)));
    const couleur = document.createElement('select');
    couleur.append(...['blanc', 'jaune', 'rouge'].map(item => new Option(item, item)));
    const { form, valider } = formulaireHistorique('Carton sur ce Five', 'Ajouter le carton', async () => {
      await historiqueAction('carton', match.id, { joueur: joueur.value, couleur: couleur.value });
      await chargerCartonsParFive();
    });
    ajouterChamp(form, 'Joueur', joueur);
    ajouterChamp(form, 'Couleur du carton', couleur);
    form.append(valider);
    espaceResultat.append(form);
  }

  async function chargerJoueurs() {
    const requete = ++lecture;
    const match = matchs.find(item => item.id === choix.value);
    archive.hidden = match === undefined;
    archive.textContent = afficherArchives ? 'Sortir des archives' : 'Archiver ce match';
    liste.replaceChildren();
    espaceResultat.replaceChildren();

    if (match === undefined) {
      liste.append(texte('p', afficherArchives ? 'Aucun match archivé.' : 'Aucun match dans le tableau principal.'));
      return;
    }

    const joueurs = await appeler('joueurs', { p_match_id: match.id });
    if (requete === lecture) {
      if (joueurs.length === 0) liste.append(texte('p', 'Aucun inscrit.'));
      for (const joueur of joueurs) {
        const ligneJoueur = ligne();
        const statut = joueur.bloque ? 'Numéro bloqué'
          : joueur.statut === 'retire' ? 'Bloqué pour ce match'
          : joueur.statut === 'confirmed' ? 'Confirmé' : 'En attente';
        const carton = joueur.carton ? `Carton ${joueur.carton}` : '';
        ligneJoueur.append(
          texte('span', [joueur.prenom, joueur.numero, statut, carton].filter(Boolean).join(' · ')),
          actionsJoueur(joueur, match)
        );
        liste.append(ligneJoueur);
      }
      try {
        const resultat = await historiqueAction('lire', match.id, {});
        if (requete === lecture) afficherResultatAdmin(match, joueurs, resultat);
      } catch (erreur) {
        if (requete === lecture) espaceResultat.append(texte('p', erreur.message));
      }
    }
  }

  async function charger() {
    const precedent = choix.value;
    const [tousLesMatchs, numeros, cartons] = await Promise.all([
      appeler('matchs'), appeler('numeros'), appeler('sanctions')
    ]);
    matchs = tousLesMatchs;
    const visibles = matchs.filter(match => match.archived_admin === afficherArchives);
    if (afficherArchives) visibles.reverse();

    choix.replaceChildren();
    for (const match of visibles) {
      choix.append(new Option(`${match.title} · ${date.format(new Date(match.starts_at))}`, match.id));
    }
    if (visibles.some(match => match.id === precedent)) {
      choix.value = precedent;
    } else if (afficherArchives === false) {
      const prochain = visibles.find(match => new Date(match.starts_at).getTime() > Date.now());
      if (prochain) choix.value = prochain.id;
    }

    bloques.replaceChildren();
    if (numeros.length === 0) bloques.append(texte('p', 'Aucun numéro bloqué.'));
    for (const fiche of numeros) {
      const entree = ligne();
      entree.append(
        texte('span', [fiche.prenom, fiche.numero].filter(Boolean).join(' · ')),
        bouton('Débloquer', () => modifier('debloquer_numero', { p_numero: fiche.numero }))
      );
      bloques.append(entree);
    }

    sanctions.replaceChildren();
    if (cartons.length === 0) sanctions.append(texte('p', 'Aucun carton en cours.'));
    for (const joueur of cartons) {
      const entree = ligne();
      entree.append(
        texte('span', [joueur.prenom, joueur.numero, `Carton ${joueur.carton}`, joueur.motif].filter(Boolean).join(' · ')),
        bouton('Enlever le carton', () => modifierCarton('enlever_carton', joueur))
      );
      sanctions.append(entree);
    }

    await chargerJoueurs();
  }

  function afficherErreur(erreur) { message.textContent = erreur.message; }

  choix.addEventListener('change', () => chargerJoueurs().catch(afficherErreur));

  vue.addEventListener('click', () => {
    if (enCours) return;
    afficherArchives = (afficherArchives === false);
    vue.textContent = afficherArchives ? 'Voir le tableau principal' : 'Voir les archives';
    charger().catch(afficherErreur);
  });

  archive.addEventListener('click', () => {
    if (choix.value === '') return;
    modifier(afficherArchives ? 'desarchiver' : 'archiver', { p_match_id: choix.value });
  });

  formulaire.addEventListener('submit', async event => {
    event.preventDefault();
    const numero = new FormData(formulaire).get('numero');
    if (window.confirm(`Bloquer ${numero} pour tous les matchs ?`) === false) return;
    if (await modifier('bloquer_numero', { p_numero: numero })) formulaire.reset();
  });

  charger().catch(afficherErreur);
  chargerCartonsParFive().catch(erreur => {
    historiqueCartons.textContent = erreur.message;
  });
}
