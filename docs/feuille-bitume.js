const clientFeuille = window.supabase?.createClient(
  new URL(urlDisponibilites).origin, SUPABASE_KEY,
  { auth: { storageKey: 'bitume-session-joueur' } }
);
let demandeFeuille = 0;
const cadragesMaillots = fetch('cadrage-maillots.json')
  .then(reponse => reponse.ok ? reponse.json() : {})
  .catch(() => ({}));

function creerMaillot(joueur, catalogue, rang, cadrages) {
  const article = document.createElement('li');
  article.className = 'feuille-joueur';
  const equipe = catalogue.find(item => item.id === joueur.equipe);
  const visuel = document.createElement('div');
  visuel.className = 'feuille-visuel';
  if (equipe) {
    const image = document.createElement('img');
    image.alt = `Maillot domicile · ${equipe.label}`;
    image.loading = 'lazy';
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => afficherMaillotBitume(visuel), { once: true });
    const cadrage = cadrages[equipe.id];
    if (cadrage) {
      const [largeur, hauteur, gauche, haut, droite, bas] = cadrage;
      const hauteurVisible = bas - haut;
      image.classList.add('feuille-maillot-cadre');
      image.style.height = `${100 * hauteur / hauteurVisible}%`;
      image.style.top = `${-100 * haut / hauteurVisible}%`;
      image.style.transform = `translateX(${-50 * (gauche + droite) / largeur}%)`;
    }
    image.src = equipe.image;
    visuel.append(image);
  } else {
    afficherMaillotBitume(visuel);
  }
  const nom = document.createElement('strong');
  nom.textContent = joueur.prenom;
  article.append(visuel, nom);
  const numero = document.createElement('span');
  numero.className = 'feuille-numero';
  numero.textContent = `N° ${rang}`;
  article.append(numero);
  return article;
}

function afficherMaillotBitume(visuel) {
  const image = document.createElement('img');
  image.src = 'maillot-bitume.png';
  image.alt = 'Maillot domicile du Five du Bitume';
  image.loading = 'lazy';
  visuel.replaceChildren(image);
}

function creerFeuilleMatch(match, catalogue, cadrages) {
    const feuille = document.createElement('section');
    feuille.className = 'feuille-panneau';
    feuille.setAttribute('aria-label', 'Feuille de match');
    feuille.innerHTML = '<div class="feuille-entete"><img src="logo.PNG" alt=""><div><h2>Feuille de match</h2><p></p></div></div>';
    feuille.querySelector('p').textContent = `${match.joueurs.length}/${match.capacity} inscrits`;
    const liste = document.createElement('ul');
    liste.className = 'feuille-maillots';
    match.joueurs.forEach((joueur, index) => liste.append(creerMaillot(joueur, catalogue, index + 1, cadrages)));
    if (match.joueurs.length) feuille.append(liste);
    return feuille;
}

const dateAgenda = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris'
});

async function chargerAgenda() {
  const zone = document.querySelector('#calendrier-accueil');
  if (!zone || document.hidden) return;
  const demande = ++demandeFeuille;
  try {
    const [disponibles, feuilles, catalogue, cadrages] = await Promise.all([
      lireDisponibilites(),
      clientFeuille.rpc('feuilles_agenda_five'),
      catalogueMaillots.charger().catch(() => []),
      cadragesMaillots
    ]);
    if (demande !== demandeFeuille || !zone.isConnected) return;
    const parMatch = new Map((feuilles.data || []).map(item => [item.match_id, item]));
    const cartes = disponibles.filter(m => Date.parse(m.starts_at) > Date.now())
      .sort((a,b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id))
      .map(match => {
        const carte = document.querySelector('#modele-match').content.firstElementChild.cloneNode(true);
        const feuille = parMatch.get(match.id);
        carte.querySelector('.date-match').textContent = dateAgenda.format(new Date(match.starts_at));
        carte.querySelector('.places-match').textContent = textePlaces(match.places_restantes);
        afficherTerrainFive(carte.querySelector('.terrain-five'), feuille?.lieu || match.venue || 'Terrain à préciser');
        const id = encodeURIComponent(match.id);
        carte.querySelector('[data-reserver]').href = 'joueur.html?match=' + id;
        carte.querySelector('[data-retirer]').href = 'joueur.html?retrait=1&match=' + id;
        carte.querySelector('.feuille-match').append(feuille
          ? creerFeuilleMatch(feuille, catalogue, cadrages)
          : 'Feuille de match temporairement indisponible.');
        return carte;
      });
    zone.replaceChildren(...(cartes.length ? cartes : ['Aucun Five programmé pour le moment.']));
  } catch {
    if (demande === demandeFeuille && zone.isConnected && !zone.children.length)
      zone.textContent = 'Calendrier temporairement indisponible.';
  }
}

for (const evenement of ['pageshow', 'focus', 'hashchange'])
  window.addEventListener(evenement, chargerAgenda);
setInterval(chargerAgenda, 30000);
if ('BroadcastChannel' in window) {
  const canalAgenda = new BroadcastChannel('bitume-matchs');
  canalAgenda.addEventListener('message', chargerAgenda);
}
chargerAgenda();
