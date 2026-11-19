const catalogueMaillots = (() => {
  const noms = {
    Algeria: 'Algérie', Brazil: 'Brésil', Germany: 'Allemagne',
    England: 'Angleterre', Spain: 'Espagne', Portugal: 'Portugal',
    Morocco: 'Maroc', Netherlands: 'Pays-Bas', Japan: 'Japon',
    Belgium: 'Belgique', Switzerland: 'Suisse', Croatia: 'Croatie',
    Mexico: 'Mexique', USA: 'États-Unis', 'South Korea': 'Corée du Sud',
    "Côte d'Ivoire": "Côte d’Ivoire", Tunisia: 'Tunisie', Senegal: 'Sénégal',
    Norway: 'Norvège', Scotland: 'Écosse', Austria: 'Autriche',
    'Saudi Arabia': 'Arabie saoudite', 'New Zealand': 'Nouvelle-Zélande',
    Colombia: 'Colombie', Ecuador: 'Équateur', Australia: 'Australie',
    Italy: 'Italie', Sweden: 'Suède', 'Cabo Verde': 'Cap-Vert', Egypt: 'Égypte', 'DR Congo': 'RD Congo',
    'Bosnia and Herzegovina': 'Bosnie-Herzégovine'
  };
  const alias = {
    'Real Madrid': ['real', 'real madrid cf'],
    'Olympique de Marseille (OM)': ['om', 'marseille'],
    'Paris Saint-Germain (PSG)': ['psg', 'paris', 'paris sg'],
    'FC Barcelona': ['barça', 'barcelone', 'fcb'],
    'Manchester United': ['man utd', 'man united', 'mu'],
    'Manchester City': ['man city', 'city'],
    'Inter Milan': ['inter', 'internazionale'],
    'Olympique Lyonnais': ['ol', 'lyon'],
    'Bayern Munich': ['bayern', 'munich'],
    Algeria: ['fennecs', 'dz'],
    Morocco: ['lions de l atlas'],
    France: ['les bleus'],
    Belgium: ['diables rouges']
  };
  function normaliser(texte) {
    return texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
  let chargement;
  function charger() {
    chargement ??= fetch('catalogue-maillots.json').then(reponse => {
      if (!reponse.ok) throw new Error('Catalogue indisponible');
      return reponse.json();
    }).then(equipes => equipes.map(equipe => ({
      ...equipe,
      label: noms[equipe.name] || equipe.name,
      termes: [equipe.name, noms[equipe.name], ...(alias[equipe.name] || [])]
        .filter(Boolean).map(normaliser)
    })));
    return chargement;
  }
  function chercher(equipes, saisie) {
    const recherche = normaliser(saisie);
    if (recherche.length < 2) return [];
    return equipes.map(equipe => {
      const score = Math.min(...equipe.termes.map(terme =>
        terme === recherche ? 0 : terme.startsWith(recherche) ? 1 :
          terme.includes(recherche) ? 2 : 3));
      return { equipe, score };
    }).filter(resultat => resultat.score < 3)
      .sort((a, b) => a.score - b.score ||
        (a.equipe.name === 'Real Madrid' ? -1 : b.equipe.name === 'Real Madrid' ? 1 : 0) ||
        a.equipe.label.localeCompare(b.equipe.label, 'fr'))
      .slice(0, 8).map(resultat => resultat.equipe);
  }
  return { charger, chercher };
})();
