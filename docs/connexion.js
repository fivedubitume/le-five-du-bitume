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

    const { access_token: token, user } = await response.json();
    const profileResponse = await fetch(`${projectUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=first_name,role`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });

    if (!profileResponse.ok) {
      result.textContent = `Connexion réussie, mais lecture du profil impossible (${profileResponse.status}).`;
      return;
    }

    const [profile] = await profileResponse.json();
    if (profile?.role === 'admin') {
      form.hidden = true;
      result.textContent = 'Connecté · ' + profile.first_name;
      afficherGestionAdmin(token);
    } else result.textContent = 'Accès réservé à l’administrateur.';
  } catch {
    result.textContent = 'Connexion à Supabase impossible. Vérifie ta connexion Internet.';
  } finally {
    form.elements.password.value = '';
    button.disabled = false;
  }
});
