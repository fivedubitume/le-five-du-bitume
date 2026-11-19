# Le Five du Bitume

Première version interactive et autonome. Les joueurs, les scores et les tournois fournis sont fictifs. Les modifications de la démonstration restent dans le navigateur. L’espace « Admin démo » sert à essayer les formulaires et les règles de présence.

## Tester en local

```sh
python3 -m http.server 8000 --directory docs
```

Ouvrir http://localhost:8000. Dans « Admin démo », l’horloge simulée permet de tester le désistement à moins de 24 heures.

## Publier la démonstration avec GitHub Pages

Créer un dépôt GitHub public dédié, puis depuis ce dossier :

```sh
git init -b main
git add .
git commit -m "Première version de Le Five du Bitume"
git remote add origin URL_DU_DEPOT
git push -u origin main
```

Dans **Settings → Pages**, choisir la branche `main` et le dossier `/docs`.

## Mise en service pour le groupe

Le prototype utilise un profil fictif unique et ne doit recevoir aucune donnée personnelle réelle. L’ouverture au groupe dépend de la connexion à un projet Supabase avec comptes sur invitation, permissions côté base de données, séparation du téléphone privé et double authentification pour l’administrateur. Les fonctions encore à relier ou à compléter comprennent les inscriptions partagées, les votes authentifiés, l’exclusion réelle, les notifications, les compositions et le tableau des tournois.
