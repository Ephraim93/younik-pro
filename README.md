# YOUNIK — Advanced Skin Therapy

Site web professionnel avec back-office sécurisé.

## Démarrage local

```bash
npm install
npm start
```
Ouvrir : http://localhost:3000

## Variables d'environnement (Railway)

| Variable | Description | Exemple |
|---|---|---|
| `PORT` | Port du serveur (auto sur Railway) | `3000` |
| `SESSION_SECRET` | Clé secrète de session | `une-longue-chaine-aleatoire` |
| `DATA_DIR` | Dossier des données (optionnel) | `/data` |

## Déploiement Railway

1. Pousser ce repo sur GitHub
2. Connecter à Railway → "Deploy from GitHub Repo"
3. Ajouter la variable `SESSION_SECRET` dans les paramètres Railway
4. C'est tout — Railway détecte Node.js et lance `npm start` automatiquement

## Accès admin

URL : `/admin`  
Mot de passe par défaut : `younik2024` (à changer dans l'admin après connexion)
