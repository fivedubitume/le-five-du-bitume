const formulaire = document.querySelector('form');
const candidats = formulaire.querySelector('select');
const statut = document.querySelector('[role=status]');
const bouton = formulaire.querySelector('button');
const cle = location.hash.slice(1);
async function bulletin(candidat) {
  if (!/^[0-9a-f-]{36}$/i.test(cle)) throw new Error('Ce lien de vote est incomplet.');
  const reponse = await fetch(new URL('/rest/v1/rpc/bulletin_vote_prive',urlDisponibilites), {
    method:'POST', cache:'no-store', headers:{apikey: SUPABASE_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({p_cle:cle,p_candidat:candidat})
  });
  const data = await reponse.json();
  if (!reponse.ok) throw new Error(data.message || 'Vote indisponible.');
  if (['enregistre','deja_vote'].includes(data.statut)) {
    formulaire.hidden = true;
    statut.className = 'vote-recu';
    statut.textContent = data.statut === 'enregistre' ? '✓ Ton vote a été validé !' : '✓ Ta voix est déjà comptabilisée pour ce Five.';
    return;
  }
  if (data.statut !== 'ouvert' || candidat) throw new Error('Enregistrement non confirmé.');
  document.querySelector('#rencontre').textContent = new Date(data.debut).toLocaleString('fr-FR',{dateStyle:'long',timeStyle:'short',timeZone:'Europe/Paris'});
  candidats.replaceChildren(new Option('Sélectionner un joueur',''),...data.candidats.map(j=>new Option(j.prenom,j.id)));
  formulaire.hidden = false;
  statut.textContent = '';
}
formulaire.addEventListener('submit',async e=>{
  e.preventDefault();
  bouton.disabled = true;
  try { await bulletin(candidats.value); } catch(err){ statut.textContent=err.message; }
  finally { bouton.disabled=false; }
});
bulletin(null).catch(err=>{statut.textContent=err.message;});
