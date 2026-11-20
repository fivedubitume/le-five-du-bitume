installerChoixTerrainFive(document.querySelector('#terrains-organiser'), 'terrain');

const formulaireFive = document.querySelector('#organiser-five');
const champsProfilFive = document.querySelector('#organiser-profil');
const messageOrganisation = document.querySelector('#organiser-message');
const liensOrganisation = document.querySelector('#organiser-liens');
const publierFive = formulaireFive.querySelector('button');
const clientOrganisation = window.supabase?.createClient(new URL(urlDisponibilites).origin, SUPABASE_KEY, {
  auth: { storageKey: 'bitume-session-joueur' }
});
const demandeOrganisation = crypto.randomUUID();

async function sessionOrganisation() {
  const { data, error } = await clientOrganisation.auth.getSession();
  if (error) throw error;
  return data.session;
}

function masquerProfilOrganisation() {
  champsProfilFive.hidden = true;
  for (const champ of champsProfilFive.querySelectorAll('input')) champ.disabled = true;
}

publierFive.disabled = true;
(async () => {
  if (!clientOrganisation) throw new Error('Connexion temporairement indisponible.');
  const session = await sessionOrganisation();
  if (session) {
    const { data, error } = await clientOrganisation.from('profiles')
      .select('role,phone').eq('id', session.user.id).maybeSingle();
    if (error) throw error;
    if (data?.role === 'player' && data.phone) masquerProfilOrganisation();
  }
  publierFive.disabled = false;
  if (session) await chargerMesFive();
})().catch(erreur => { messageOrganisation.textContent = erreur.message; });

formulaireFive.addEventListener('submit', async event => {
  event.preventDefault();
  if (publierFive.disabled) return;
  publierFive.disabled = true;
  let publie = false;
  try {
    const champs = formulaireFive.elements;
    const debut = new Date(champs.debut.value);
    if (!(debut.getTime() > Date.now())) throw new Error('Choisis une date et une heure à venir.');
    if (!await sessionOrganisation()) {
      const { error } = await clientOrganisation.auth.signInAnonymously();
      if (error) throw error;
    }
    if (!champsProfilFive.hidden) {
      const { error } = await clientOrganisation.rpc('creer_profil_joueur', {
        p_prenom: champs.prenom.value.trim(),
        p_telephone: champs.telephone.value
      });
      if (error) throw error;
      masquerProfilOrganisation();
    }
    const { data: match, error } = await clientOrganisation.rpc('publier_et_jouer_five', {
      p_equipe: champs.equipe.value || null, p_titre: 'Five du Bitume', p_lieu: champs.terrain.value,
      p_debut: debut.toISOString(), p_places: champs.places.valueAsNumber,
      p_prix: Math.round(champs.prix.valueAsNumber * 100), p_demande: demandeOrganisation
    });
    if (error) throw error;
    publie = true;
    formulaireFive.hidden = true;
    messageOrganisation.textContent = 'Match publié. Ta place est confirmée.';
    chargerMesFive().catch(erreur => { liensOrganisation.textContent = erreur.message; });
    const lien = document.createElement('a');
    lien.className = 'btn';
    lien.href = `joueur.html?match=${encodeURIComponent(match)}`;
    lien.textContent = 'Ouvrir les inscriptions';
    const copier = document.createElement('button');
    copier.className = 'btn alt';
    copier.textContent = 'Copier le lien';
    copier.onclick = async () => {
      try {
        await navigator.clipboard.writeText(lien.href);
        messageOrganisation.textContent = 'Lien copié.';
      } catch {
        messageOrganisation.textContent = 'Ouvre les inscriptions, puis copie l’adresse depuis ton navigateur.';
      }
    };
    liensOrganisation.append(lien, copier);
  } catch (erreur) {
    messageOrganisation.textContent = erreur.message || 'Publication impossible.';
  } finally {
    publierFive.disabled = publie;
  }
});

catalogueMaillots.charger().then(equipes => {
  for (const equipe of equipes.slice().sort((a,b) => a.label.localeCompare(b.label,'fr')))
    formulaireFive.elements.equipe.add(new Option(equipe.label, equipe.id));
}).catch(() => {});

async function chargerMesFive() {
  const { data, error } = await clientOrganisation.rpc('mes_five_organises');
  if (error) throw error;
  const zone = document.querySelector('#mes-five');
  const liste = zone.querySelector('div');
  liste.replaceChildren();
  zone.hidden = !data.length;
  for (const match of data) {
    const article = document.createElement('article');
    const lieu = document.createElement('div');
    lieu.className = 'terrain-five';
    afficherTerrainFive(lieu, match.venue);
    const date = new Date(match.starts_at).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'});
    const retirer = document.createElement('button');
    retirer.className = 'btn alt';
    retirer.textContent = 'Supprimer ce match';
    retirer.onclick = async () => {
      if (!confirm('Supprimer le Five du ' + date + ' et ses inscriptions ?')) return;
      retirer.disabled = true;
      try {
        const {error} = await clientOrganisation.rpc('supprimer_five_organise',{p_match:match.id});
        if (error) throw error;
        messageOrganisation.textContent = 'Match supprimé.';
        liensOrganisation.replaceChildren();
        await chargerMesFive();
      } catch (e) { messageOrganisation.textContent = e.message; retirer.disabled = false; }
    };
    article.append(date,lieu,retirer);
    liste.append(article);
  }
}
