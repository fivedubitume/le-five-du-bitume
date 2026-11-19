const urlDisponibilites = 'https://bolgejnkaafwxnpoegoc.supabase.co/rest/v1/rpc/disponibilites_five';

async function lireDisponibilites(prochainSeulement = false) {
  const url = new URL(urlDisponibilites);
  url.searchParams.set('order', 'starts_at.asc,id.asc');
  if (prochainSeulement) url.searchParams.set('limit', '1');
  const response = await fetch(url, {
    headers: { apikey: SUPABASE_KEY },
    cache: 'no-store'
  });
  if (response.ok === false) throw new Error('Disponibilité indisponible');
  return response.json();
}

function textePlaces(nombre) {
  if (nombre === 0) return 'Complet · liste d’attente ouverte';
  return nombre === 1 ? '1 place restante' : `${nombre} places restantes`;
}

async function afficherProchainFive() {
  const info = document.querySelector('#prochain-five');
  if (info === null) return;
  try {
    const [match] = await lireDisponibilites(true);
    const format = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
    });
    info.textContent = match
      ? `${format.format(new Date(match.starts_at))} · ${textePlaces(match.places_restantes)}`
      : 'Aucun Five programmé pour le moment.';
  } catch {
    info.textContent = 'Date et places temporairement indisponibles.';
  }
}

if (document.querySelector('#app')) {
  window.addEventListener('pageshow', afficherProchainFive);
  window.addEventListener('hashchange', afficherProchainFive);
  window.addEventListener('focus', afficherProchainFive);
  setInterval(() => {
    if (document.visibilityState === 'visible') afficherProchainFive();
  }, 30000);
}

if (document.querySelector('#app') && 'BroadcastChannel' in window) {
  const canalAccueil = new BroadcastChannel('bitume-matchs');
  canalAccueil.addEventListener('message', afficherProchainFive);
}
