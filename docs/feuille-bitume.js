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

async function chargerFeuille() {
  const conteneur = document.querySelector('#accueil-feuille');
  if (!conteneur || document.visibilityState === 'hidden') return;
  const demande = ++demandeFeuille;
  try {
    if (!clientFeuille) throw new Error('Supabase indisponible');
    const { data: matchs, error } = await clientFeuille.rpc('feuille_maillots_five');
    if (error) throw error;
    const match = matchs[0];
    if (!match) {
      conteneur.replaceChildren();
      return;
    }
    const [catalogue, cadrages] = await Promise.all([
      catalogueMaillots.charger().catch(() => []),
      cadragesMaillots
    ]);
    if (demande !== demandeFeuille || !conteneur.isConnected) return;
    const feuille = document.createElement('section');
    feuille.className = 'feuille-panneau';
    feuille.setAttribute('aria-label', 'Feuille de match');
    feuille.innerHTML = '<div class="feuille-entete"><img src="logo.PNG" alt=""><div><h2>Feuille de match</h2><p></p></div></div>';
    feuille.querySelector('p').textContent = `${match.joueurs.length}/${match.capacity} inscrits`;
    const liste = document.createElement('ul');
    liste.className = 'feuille-maillots';
    match.joueurs.forEach((joueur, index) => liste.append(creerMaillot(joueur, catalogue, index + 1, cadrages)));
    if (match.joueurs.length) feuille.append(liste);
    if (match.joueurs.some(joueur => joueur.equipe)) {
      const source = document.createElement('a');
      source.className = 'feuille-source';
      source.href = 'https://www.footylogos.com/football-kits';
      source.textContent = 'Visuels FootyLogos';
      feuille.append(source);
    }
    conteneur.replaceChildren(feuille);
  } catch {
    if (demande === demandeFeuille && conteneur.isConnected) {
      conteneur.textContent = 'Feuille de match temporairement indisponible.';
    }
  }
}

for (const evenement of ['pageshow', 'focus', 'hashchange']) {
  window.addEventListener(evenement, chargerFeuille);
}
setInterval(chargerFeuille, 30000);
if ('BroadcastChannel' in window) {
  const canalFeuille = new BroadcastChannel('bitume-matchs');
  canalFeuille.addEventListener('message', chargerFeuille);
}
chargerFeuille();
