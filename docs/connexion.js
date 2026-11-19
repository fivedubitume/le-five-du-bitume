const projectUrl = 'https://bolgejnkaafwxnpoegoc.supabase.co';
const form = document.querySelector('#connexion');
const result = document.querySelector('#resultat');
const button = form.querySelector('button');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const fields = new FormData(form);
  button.disabled = true;
  result.textContent = 'Connexion en cours…';

  try {
    const response = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fields.get('email').trim(),
        password: fields.get('password')
      })
    });

    if (!response.ok) {
      result.textContent = `Connexion refusée (${response.status}). Vérifie ton compte Supabase et la clé du projet.`;
      return;
    }

    const { access_token: token } = await response.json();
    const profileResponse = await fetch(`${projectUrl}/rest/v1/profiles?select=first_name,role`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });

    if (!profileResponse.ok) {
      result.textContent = `Connexion réussie, mais lecture du profil impossible (${profileResponse.status}).`;
      return;
    }

    const [profile] = await profileResponse.json();
    if (profile) afficherMatchsReels(token);

    if (profile?.role === "admin") afficherCreationMatch(token);
    result.textContent = profile
      ? `Connexion réussie · ${profile.first_name} · rôle : ${profile.role}`
      : 'Connexion réussie, mais aucun profil associé à ce compte.';
  } catch {
    result.textContent = 'Connexion à Supabase impossible. Vérifie ta connexion Internet.';
  } finally {
    form.elements.password.value = '';
    button.disabled = false;
  }
});

function afficherCreationMatch(token) {
  form.hidden = true;
  const section = document.createElement('section');
  section.className = 'card section';
  section.innerHTML = `
    <h2>Créer un match</h2>
    <form>
      <label>Nom du match
        <input name="title" value="Five du mercredi" maxlength="60" required>
      </label>
      <label>Date et heure (heure locale de cet appareil)
        <input name="starts_at" type="datetime-local" required>
      </label>
      <label>Lieu
        <input name="venue" value="Wittenheim" maxlength="60" required>
      </label>
      <label>Nombre de places
        <input name="capacity" type="number" min="2" max="120" value="10" required>
      </label>
      <label>Prix en euros
        <input name="price" type="number" min="0" max="100" step="0.01" value="15" required>
      </label>
      <button class="btn">Enregistrer le match</button>
    </form>
    <p class="section" role="status"></p>
  `;

  const matchForm = section.querySelector('form');
  const save = matchForm.querySelector('button');
  const feedback = section.querySelector('[role="status"]');

  matchForm.addEventListener('submit', async event => {
    event.preventDefault();
    const fields = new FormData(matchForm);
    const title = fields.get('title').trim();
    const venue = fields.get('venue').trim();
    if (title.length === 0 || venue.length === 0) {
      feedback.textContent = 'Renseigne le nom et le lieu du match.';
      return;
    }

    save.disabled = true;
    feedback.textContent = 'Enregistrement en cours…';
    try {
      const response = await fetch(`${projectUrl}/rest/v1/matches`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({
          title,
          venue,
          starts_at: new Date(fields.get('starts_at')).toISOString(),
          capacity: Number(fields.get('capacity')),
          price_cents: Math.round(Number(fields.get('price')) * 100)
        })
      });

      if (response.ok) {
        feedback.textContent = 'Match enregistré dans Supabase.';
        matchForm.elements.starts_at.value = '';
        afficherMatchsReels(token);

      } else if (response.status === 401) {
        feedback.textContent = 'Actualise la page et reconnecte-toi.';
      } else {
        feedback.textContent = `Enregistrement refusé (${response.status}).`;
      }
    } catch {
      feedback.textContent = 'Envoi non confirmé. Vérifie la table matches avant de réessayer.';
    } finally {
      save.disabled = false;
    }
  });

  result.after(section);
}

async function afficherMatchsReels(token) {
  let section = document.querySelector('#matchs-reels');
  if (section === null) {
    section = document.createElement('section');
    section.id = 'matchs-reels';
    section.className = 'card section';
    result.after(section);
  }

  section.innerHTML = '<h2>Matchs à venir</h2><div aria-live="polite">Chargement…</div>';
  const list = section.querySelector('div');

  try {
    const url = new URL(`${projectUrl}/rest/v1/matches`);
    url.searchParams.set('select', 'title,starts_at,venue,capacity,price_cents');
    url.searchParams.set('starts_at', `gte.${new Date().toISOString()}`);
    url.searchParams.set('order', 'starts_at.asc');
    const response = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });

    if (response.ok === false) {
      list.textContent = response.status === 401
        ? 'Session expirée. Actualise la page et reconnecte-toi.'
        : `Chargement impossible (${response.status}).`;
      return;
    }

    const matches = await response.json();
    if (matches.length === 0) {
      list.textContent = 'Aucun match à venir.';
      return;
    }

    const date = new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris'
    });
    const price = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: 'EUR'
    });

    list.replaceChildren();
    for (const match of matches) {
      const row = document.createElement('div');
      row.className = 'row';
      const title = document.createElement('strong');
      title.textContent = match.title;
      const details = document.createElement('span');
      details.textContent = `${date.format(new Date(match.starts_at))} · ${match.venue} · ${match.capacity} places au total · ${price.format(match.price_cents / 100)}`;
      row.append(title, details);
      list.append(row);
    }
  } catch {
    list.textContent = 'Impossible de charger les matchs. Réessaie après avoir actualisé la page.';
  }
}
