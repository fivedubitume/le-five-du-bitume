const feuille = document.createElement('section');
feuille.id = 'feuille-bitume';
feuille.className = 'wrap card';
feuille.innerHTML = `
  <div class="feuille-entete">
    <img src="logo.PNG" alt="">
    <div><h2>Feuille de match</h2><p id="feuille-info"></p></div>
  </div>
  <div class="maillots" id="feuille-maillots"></div>
`;
document.querySelector('#app').after(feuille);

const feuilleInfo = feuille.querySelector('#feuille-info');
const maillots = feuille.querySelector('#feuille-maillots');
const clientFeuille = window.supabase?.createClient(
  new URL(urlDisponibilites).origin, SUPABASE_KEY,
  { auth: { storageKey: 'bitume-session-joueur' } }
);

async function chargerFeuille() {
  if (document.visibilityState === 'hidden') return;
  try {
    if (clientFeuille === undefined) throw new Error('Supabase indisponible');
    const { data: { session }, error: erreurSession } = await clientFeuille.auth.getSession();
    if (erreurSession) throw erreurSession;
    if (session === null) {
      maillots.replaceChildren();
      feuilleInfo.textContent = 'Ouvre l’espace joueur pour voir les inscrits.';
      return;
    }

    const { data, error } = await clientFeuille.rpc('feuille_prochain_five');
    if (error) throw error;
    const match = data[0];
    maillots.replaceChildren();
    if (match === undefined) {
      feuilleInfo.textContent = 'Aucune feuille de match disponible.';
      return;
    }

    const date = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
    });
    feuilleInfo.textContent =
      `${date.format(new Date(match.starts_at))} · ${match.prenoms.length}/${match.capacity} inscrits`;

    for (let place = 0; place < match.capacity; place += 1) {
      const prenom = match.prenoms[place];
      const maillot = document.createElement('div');
      maillot.className = prenom ? 'maillot' : 'maillot libre';
      const nom = document.createElement('strong');
      nom.textContent = prenom || 'Disponible';
      maillot.append(nom);
      maillots.append(maillot);
    }
  } catch {
    maillots.replaceChildren();
    feuilleInfo.textContent = 'Feuille de match temporairement indisponible.';
  }
}

function afficherFeuilleAccueil() {
  feuille.hidden = location.hash !== '' && location.hash !== '#accueil';
  if (feuille.hidden === false) chargerFeuille();
}

window.addEventListener('pageshow', afficherFeuilleAccueil);
window.addEventListener('focus', afficherFeuilleAccueil);
window.addEventListener('hashchange', afficherFeuilleAccueil);
setInterval(() => {
  if (feuille.hidden === false) chargerFeuille();
}, 30000);

if ('BroadcastChannel' in window) {
  const canalFeuille = new BroadcastChannel('bitume-matchs');
  canalFeuille.addEventListener('message', afficherFeuilleAccueil);
}
