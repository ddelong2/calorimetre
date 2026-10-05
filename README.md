# Calorimètre

Web app mobile (Next.js sur Snowflake App Runtime) : on photographie son repas, **Cortex AI** (`AI_COMPLETE` + un modèle vision) identifie les aliments et estime les calories et macronutriments. L'utilisateur ajuste la portion, puis enregistre le repas dans un historique.

## Fonctionnement

1. Le téléphone prend la photo (`<input capture="environment">`). Elle est redimensionnée côté client (1280 px, JPEG).
2. `POST /api/analyze` dépose l'image dans le stage `FOOD_IMAGES` (`PUT`) et appelle `AI_COMPLETE(model, prompt, TO_FILE(...), …, response_format)` avec un schéma JSON imposé.
3. L'utilisateur choisit la portion (petite / normale / grande, ou un curseur de × 0,5 à × 2).
4. `POST /api/meals` enregistre le repas dans la table `MEALS`, avec les valeurs multipliées par le facteur de portion et la réponse brute du modèle.
5. `GET /api/meals` affiche les 7 derniers jours de l'utilisateur, avec le total par jour.

| Fichier | Rôle |
|---|---|
| `app/api/analyze/route.ts` | Upload de la photo et appel à `AI_COMPLETE` |
| `app/api/meals/route.ts` | Historique : lecture, enregistrement, suppression |
| `lib/nutrition.ts` | Prompt, schéma JSON, types |
| `lib/config.ts` | Paramètres propres au compte (variables d'environnement) |
| `components/meal-capture.tsx` | Caméra, résultat, choix de la portion |
| `components/meal-history.tsx` | Historique |
| `sql/setup.sql` | Objets Snowflake (stage SSE et table `MEALS`) |

## Déployer sur un compte (nouveau ou existant)

Prérequis : Snowflake CLI ≥ 3.26, Node 20+, et un rôle qui peut créer une application service ainsi que des objets dans le schéma cible. Le modèle choisi doit être disponible dans la région du compte, ou le cross-region inference doit être activé.

```bash
# 1. Créer les objets de données
snow sql -c <connexion> -f sql/setup.sql \
  -D database=<DB> -D schema=<SCHEMA> -D app_role=<ROLE>

# 2. Adapter app.yml :
#    - database / schema / query_warehouse : où l'application service est créée
#    - environment_variables CALO_DATABASE / CALO_SCHEMA : où sont les données (= setup.sql)
#    - CALO_MODEL : modèle vision (ex. claude-sonnet-4-6)

# 3. Déployer
snow app deploy -c <connexion> --role <ROLE>
snow app open   -c <connexion> --role <ROLE>
```

Pour gérer plusieurs comptes depuis un seul `app.yml`, on peut ajouter un bloc `targets:` (par exemple `snowhouse`, `demo`) et déployer avec `--target`.

### Déploiement actuel

| | |
|---|---|
| Compte | Snowhouse (`SFCOGSOPS-SNOWHOUSE_AWS_US_WEST_2`) |
| Service | `APPS.PUBLIC.CALORIMETRE` (rôle `SALES_ENGINEER`, warehouse `SNOWADHOC`) |
| Données | `TEMP.DDELONG.FOOD_IMAGES`, `TEMP.DDELONG.MEALS` |

## Sur le téléphone

Ouvrir l'URL de l'app dans Safari ou Chrome, se connecter avec son compte Snowflake, puis **Partager → Sur l'écran d'accueil**. L'app s'ouvre alors en plein écran.

## Développement local

```bash
npm install
SNOWFLAKE_CONNECTION_NAME=<connexion> SNOWFLAKE_ROLE=<ROLE> SNOWFLAKE_WAREHOUSE=<WH> npm run dev
```

En local, les repas sont rattachés à l'utilisateur `local`. Une fois déployée, l'app utilise l'en-tête `sf-context-current-user` injecté par Snowflake.

## Limites

Les calories sont une **estimation**. L'identification des aliments est fiable, mais la portion et les matières grasses invisibles peuvent faire varier le total de ± 20 à 40 %. Ce n'est pas un outil médical.
