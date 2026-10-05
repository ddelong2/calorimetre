# Calorimètre

Web app mobile (Next.js sur Snowflake App Runtime) : on photographie son repas, **Cortex AI** (`AI_COMPLETE` + un modèle vision) identifie les aliments et estime calories et macronutriments. Chaque utilisateur a son compte, son objectif calorique journalier et un historique complet.

## Fonctionnalités

- **Compte** : créé automatiquement à la première connexion. Un écran « Créer mon profil » demande le prénom et l'objectif en kcal par jour. Le profil se modifie ensuite depuis l'onglet Profil.
- **Repas** : photo → analyse → choix de la portion (petite / normale / grande, ou curseur), du type de repas et d'une note → enregistrement. L'accueil affiche le total du jour par rapport à l'objectif.
- **Historique** : graphique des 30 derniers jours avec la ligne d'objectif, navigation par semaine, total par jour. Pour chaque repas : photo, macros et détail par aliment.
- **Conservation** : un repas supprimé n'est que masqué (`DELETED_AT`), avec un bouton « Annuler » ; rien n'est effacé.
- **Isolation** : chaque route filtre sur l'identifiant interne de l'utilisateur ; on ne peut ni voir, ni modifier, ni supprimer le repas ou la photo d'un autre utilisateur.

## Architecture

```
Téléphone ──▶ Connexion Snowflake (ingress SPCS) ──▶ App Next.js (APPS.PUBLIC.CALORIMETRE)
                                                       │  lib/auth.ts : sf-context-current-user → APP_USERS
                                                       ├─ PUT photo  → @FOOD_IMAGES/<USER_ID>/<uuid>.jpg
                                                       ├─ AI_COMPLETE(model, prompt, TO_FILE(...), schéma JSON)
                                                       └─ MEALS / MEAL_ITEMS (filtrés par USER_ID)
```

### Modèle de données (`sql/setup.sql`)

| Objet | Contenu |
|---|---|
| `APP_USERS` | Un compte par identité : `AUTH_PROVIDER` (`snowflake` aujourd'hui, `password` prévu) + `AUTH_SUBJECT`, prénom, objectif kcal, `PASSWORD_HASH` (réservé) |
| `MEALS` | Un repas confirmé : totaux déjà ajustés à la portion, type, note, chemin de la photo, réponse brute du modèle (`ANALYSIS`), `DELETED_AT` |
| `MEAL_ITEMS` | Un aliment par ligne (portion ajustée) : base des futures recommandations de substitution |
| `FOOD_IMAGES` | Stage chiffré côté serveur (`SNOWFLAKE_SSE`, requis par les fonctions AI sur fichiers) |

`setup.sql` est idempotent : il crée les objets sur un compte neuf **et** met à jour une base v1 (ajout des colonnes, création des comptes à partir de `USER_NAME`, éclatement de `ANALYSIS` vers `MEAL_ITEMS`).

### Code

| Fichier | Rôle |
|---|---|
| `lib/auth.ts` | `getCurrentUser()` : identité → compte `APP_USERS` (création à la première visite, cache 60 s) |
| `lib/config.ts` | Paramètres propres au compte : `CALO_DATABASE`, `CALO_SCHEMA`, `CALO_STAGE`, `CALO_MODEL`, `CALO_AUTH_MODE` |
| `lib/nutrition.ts` | Prompt, schéma JSON, types, types de repas |
| `lib/meals.ts` | Colonnes, mapping et vérification d'appartenance d'un repas |
| `lib/client.ts` | Hooks côté navigateur (`useMe`, `useMeals`, `useStats`…) et utilitaires de dates |
| `app/api/analyze` | Upload de la photo et appel à `AI_COMPLETE` |
| `app/api/me` | Lecture et mise à jour du profil |
| `app/api/meals`, `app/api/meals/[id]`, `.../photo` | Liste par période, enregistrement, détail, modification et restauration, suppression logique, photo |
| `app/api/stats` | Totaux par jour (dans le fuseau horaire du navigateur) |
| `components/*-screen.tsx` | Écrans Repas, Historique, Profil ; `bottom-nav.tsx` pour la navigation mobile |

## Déployer sur un compte (nouveau ou existant)

Prérequis : Snowflake CLI ≥ 3.26, Node 20+, et un rôle qui peut créer une application service et des objets dans le schéma cible. Le modèle doit être disponible dans la région du compte, ou le cross-region inference doit être activé.

```bash
git clone https://github.com/ddelong2/calorimetre.git && cd calorimetre && npm install

# 1. Objets de données (création ou mise à jour)
snow sql -c <connexion> -f sql/setup.sql \
  -D database=<DB> -D schema=<SCHEMA> -D app_role=<ROLE>

# 2. Adapter app.yml :
#    - database / schema / query_warehouse : où l'application service est créée
#    - CALO_DATABASE / CALO_SCHEMA : où sont les données (= setup.sql)
#    - CALO_MODEL : modèle vision (ex. claude-sonnet-4-6)

# 3. Déployer, puis ouvrir l'accès à d'autres rôles si besoin
snow app deploy -c <connexion> --role <ROLE>
snow sql -c <connexion> -q "GRANT USAGE ON APPLICATION SERVICE <DB>.<SCHEMA>.CALORIMETRE TO ROLE <ROLE_UTILISATEURS>"
```

### Déploiement actuel

| | |
|---|---|
| Compte | Snowhouse (`SFCOGSOPS-SNOWHOUSE_AWS_US_WEST_2`) |
| Service | `APPS.PUBLIC.CALORIMETRE` (rôle `SALES_ENGINEER`, warehouse `SNOWADHOC`), non partagé |
| Données | `TEMP.DDELONG` : `APP_USERS`, `MEALS`, `MEAL_ITEMS`, stage `FOOD_IMAGES` |

## Authentification

- **Mode `snowflake` (actuel)** : l'accès à une app Snowflake passe obligatoirement par une connexion Snowflake. L'app lit l'utilisateur dans l'en-tête `sf-context-current-user` et le rattache à un compte `APP_USERS`. Déconnexion via `/sfc-endpoint/logout`.
- **Mode `password` (prévu)** : inscription libre par e-mail et mot de passe (haché), avec un front hébergé hors Snowflake qui appelle Snowflake via un utilisateur de service. Les données reposent déjà uniquement sur `USER_ID`, donc seul `lib/auth.ts` changera.

## Sur le téléphone

Ouvrir l'URL dans Safari ou Chrome, se connecter, puis **Partager → Sur l'écran d'accueil**.

## Développement et tests

```bash
SNOWFLAKE_CONNECTION_NAME=<connexion> SNOWFLAKE_ROLE=<ROLE> SNOWFLAKE_WAREHOUSE=<WH> npm run dev
npm test
```

En local, il n'y a pas d'ingress Snowflake : l'app tourne avec un utilisateur fixe `local`.

## Limites

Les calories sont une **estimation**. L'identification des aliments est fiable, mais la portion et les matières grasses invisibles peuvent faire varier le total de ± 20 à 40 %. Ce n'est pas un outil médical.
