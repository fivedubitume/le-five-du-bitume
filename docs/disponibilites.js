const urlDisponibilites = 'https://bolgejnkaafwxnpoegoc.supabase.co/rest/v1/rpc/disponibilites_five';

const terrainsFive = [
  { nom: 'Le Five de Wittenheim', adresse: 'ZA du carreau Anna, site du Décathlon Village, 68270 Wittenheim', logo: 'logo-five-wittenheim.webp', alias: /wittenheim|carreau anna|68270/i },
  { nom: 'Le Five du GFC de Mulhouse', adresse: '25 Rue Josué Hofer, 68200 Mulhouse', alias: /gfc|josu[eé] hofer|68200|^mulhouse$/i }
];

function terrainFive(lieu) {
  return terrainsFive.find(terrain => terrain.alias.test((lieu || '').trim()));
}

function afficherTerrainFive(zone, lieu) {
  zone.replaceChildren();
  const terrain = terrainFive(lieu);
  if (!terrain) {
    zone.textContent = lieu || '';
    return;
  }
  const repere = document.createElement(terrain.logo ? 'img' : 'span');
  repere.className = 'terrain-repere' + (terrain.logo ? '' : ' terrain-gfc');
  if (terrain.logo) {
    repere.src = terrain.logo;
    repere.alt = '';
  } else {
    repere.textContent = 'GFC';
    repere.setAttribute('aria-hidden', 'true');
  }
  const texte = document.createElement('span');
  const nom = document.createElement('strong');
  nom.textContent = terrain.nom;
  const adresse = document.createElement('span');
  adresse.textContent = terrain.adresse;
  texte.append(nom, adresse);
  zone.append(repere, texte);
}

function installerChoixTerrainFive(zone, nomChamp) {
  const select = document.createElement('select');
  select.name = nomChamp;
  select.required = true;
  select.append(new Option('Choisir un terrain', ''),
    ...terrainsFive.map(terrain => new Option(terrain.nom, terrain.nom)));
  const label = document.createElement('label');
  label.append('Terrain', select);
  const apercu = document.createElement('div');
  apercu.className = 'terrain-five';
  zone.replaceChildren(label, apercu);
  const actualiser = () => afficherTerrainFive(apercu, select.value);
  select.addEventListener('change', actualiser);
  select.form?.addEventListener('reset', () => setTimeout(actualiser, 0));
}

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
