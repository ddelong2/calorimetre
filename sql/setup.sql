-- Calorimètre — objets Snowflake requis par l'app.
-- Idempotent : sert aussi bien à une installation neuve qu'à la mise à jour d'une base existante.
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

-- Comptes applicatifs. AUTH_PROVIDER = 'snowflake' (identité = utilisateur Snowflake connecté)
-- ou 'password' (inscription par e-mail ; PASSWORD_HASH réservé à ce mode).
CREATE TABLE IF NOT EXISTS <% database %>.<% schema %>.APP_USERS (
  USER_ID           VARCHAR       DEFAULT UUID_STRING(),
  AUTH_PROVIDER     VARCHAR       NOT NULL,
  AUTH_SUBJECT      VARCHAR       NOT NULL,
  DISPLAY_NAME      VARCHAR,
  DAILY_KCAL_TARGET NUMBER(5,0)   DEFAULT 2000,
  PASSWORD_HASH     VARCHAR,
  CREATED_AT        TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  LAST_LOGIN_AT     TIMESTAMP_LTZ,
  PROFILE_COMPLETED BOOLEAN       DEFAULT FALSE
) COMMENT = 'Calorimètre — comptes utilisateurs';

-- Repas confirmés (valeurs déjà multipliées par PORTION_FACTOR). Jamais supprimés physiquement :
-- DELETED_AT marque une suppression logique pour conserver l'historique.
CREATE TABLE IF NOT EXISTS <% database %>.<% schema %>.MEALS (
  ID             VARCHAR       DEFAULT UUID_STRING(),
  CREATED_AT     TIMESTAMP_LTZ DEFAULT CURRENT_TIMESTAMP(),
  USER_NAME      VARCHAR,
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

-- Colonnes v2 (sans effet si déjà présentes).
ALTER TABLE <% database %>.<% schema %>.MEALS ADD COLUMN IF NOT EXISTS USER_ID VARCHAR;
ALTER TABLE <% database %>.<% schema %>.MEALS ADD COLUMN IF NOT EXISTS MEAL_TYPE VARCHAR;
ALTER TABLE <% database %>.<% schema %>.MEALS ADD COLUMN IF NOT EXISTS NOTE VARCHAR;
ALTER TABLE <% database %>.<% schema %>.MEALS ADD COLUMN IF NOT EXISTS DELETED_AT TIMESTAMP_LTZ;
ALTER TABLE <% database %>.<% schema %>.MEALS ALTER COLUMN USER_NAME DROP NOT NULL;

-- Une ligne par aliment d'un repas (portion déjà ajustée) : base des futures substitutions.
CREATE TABLE IF NOT EXISTS <% database %>.<% schema %>.MEAL_ITEMS (
  MEAL_ID     VARCHAR NOT NULL,
  POSITION    NUMBER(3,0),
  NOM         VARCHAR,
  PORTION_G   NUMBER(7,1),
  KCAL        NUMBER(6,0),
  PROTEINES_G NUMBER(6,1),
  GLUCIDES_G  NUMBER(6,1),
  LIPIDES_G   NUMBER(6,1)
) COMMENT = 'Calorimètre — détail des aliments par repas';

-- Migration v1 -> v2 : un compte par USER_NAME existant, puis rattachement des repas.
MERGE INTO <% database %>.<% schema %>.APP_USERS u
USING (SELECT DISTINCT USER_NAME FROM <% database %>.<% schema %>.MEALS
        WHERE USER_ID IS NULL AND USER_NAME IS NOT NULL) m
   ON u.AUTH_PROVIDER = 'snowflake' AND u.AUTH_SUBJECT = m.USER_NAME
WHEN NOT MATCHED THEN
  INSERT (AUTH_PROVIDER, AUTH_SUBJECT, DISPLAY_NAME) VALUES ('snowflake', m.USER_NAME, m.USER_NAME);

UPDATE <% database %>.<% schema %>.MEALS m
   SET USER_ID = u.USER_ID
  FROM <% database %>.<% schema %>.APP_USERS u
 WHERE m.USER_ID IS NULL AND u.AUTH_PROVIDER = 'snowflake' AND u.AUTH_SUBJECT = m.USER_NAME;

-- Détail par aliment des repas v1, recalculé depuis ANALYSIS et le facteur de portion.
INSERT INTO <% database %>.<% schema %>.MEAL_ITEMS
  (MEAL_ID, POSITION, NOM, PORTION_G, KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G)
SELECT m.ID, f.INDEX, f.VALUE:nom::VARCHAR,
       f.VALUE:portion_g::FLOAT * m.PORTION_FACTOR,
       ROUND(f.VALUE:kcal::FLOAT * m.PORTION_FACTOR),
       f.VALUE:proteines_g::FLOAT * m.PORTION_FACTOR,
       f.VALUE:glucides_g::FLOAT * m.PORTION_FACTOR,
       f.VALUE:lipides_g::FLOAT * m.PORTION_FACTOR
  FROM <% database %>.<% schema %>.MEALS m,
       LATERAL FLATTEN(input => m.ANALYSIS:aliments) f
 WHERE NOT EXISTS (SELECT 1 FROM <% database %>.<% schema %>.MEAL_ITEMS i WHERE i.MEAL_ID = m.ID);
