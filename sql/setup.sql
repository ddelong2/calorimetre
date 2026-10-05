-- Calorimètre — objets Snowflake requis par l'app (idempotent).
--
-- Usage (adapter base / schéma / rôle au compte cible) :
--   snow sql -c <connexion> -f sql/setup.sql \
--     -D database=TEMP -D schema=DDELONG -D app_role=SALES_ENGINEER
--
-- Garder database / schema alignés avec CALO_DATABASE / CALO_SCHEMA dans app.yml.

USE ROLE <% app_role %>;

CREATE SCHEMA IF NOT EXISTS <% database %>.<% schema %>;

-- Photos des repas. Les fonctions AI sur fichiers exigent un chiffrement côté serveur.
CREATE STAGE IF NOT EXISTS <% database %>.<% schema %>.FOOD_IMAGES
  DIRECTORY = (ENABLE = TRUE)
  ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE')
  COMMENT = 'Calorimètre — photos de repas';

-- Historique des repas confirmés (valeurs déjà multipliées par PORTION_FACTOR).
CREATE TABLE IF NOT EXISTS <% database %>.<% schema %>.MEALS (
  ID             VARCHAR       DEFAULT UUID_STRING(),
  CREATED_AT     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  USER_NAME      VARCHAR       NOT NULL,
  IMAGE_PATH     VARCHAR,
  PLAT           VARCHAR,
  PORTION_FACTOR FLOAT         DEFAULT 1,
  KCAL           NUMBER(6,0),
  PROTEINES_G    NUMBER(6,0),
  GLUCIDES_G     NUMBER(6,0),
  LIPIDES_G      NUMBER(6,0),
  CONFIANCE      VARCHAR,
  ANALYSIS       VARIANT       -- réponse brute de AI_COMPLETE
) COMMENT = 'Calorimètre — repas analysés';
