/**
 * Account-specific settings, read from environment variables so the same code
 * deploys to any Snowflake account. Set them under `environment_variables:` in
 * app.yml (or in .env.local for local dev).
 */

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$]*$/
const MODEL = /^[a-z0-9][a-z0-9.\-]*$/

export type AuthMode = "snowflake" | "password"

function identifier(name: string, fallback: string): string {
  const value = process.env[name] ?? fallback
  if (!IDENTIFIER.test(value)) {
    throw new Error(`${name}="${value}" is not a valid Snowflake identifier`)
  }
  return value.toUpperCase()
}

export function getConfig() {
  const database = identifier("CALO_DATABASE", "TEMP")
  const schema = identifier("CALO_SCHEMA", "DDELONG")
  const stage = identifier("CALO_STAGE", "FOOD_IMAGES")
  const model = process.env.CALO_MODEL ?? "claude-sonnet-4-6"
  if (!MODEL.test(model)) throw new Error(`CALO_MODEL="${model}" is not a valid model name`)
  const authMode = (process.env.CALO_AUTH_MODE ?? "snowflake") as AuthMode
  if (authMode !== "snowflake") {
    throw new Error(`CALO_AUTH_MODE="${authMode}" is not supported yet (only "snowflake")`)
  }

  const prefix = `${database}.${schema}`
  return {
    model,
    authMode,
    stageName: `${prefix}.${stage}`,
    stage: `@${prefix}.${stage}`,
    usersTable: `${prefix}.APP_USERS`,
    mealsTable: `${prefix}.MEALS`,
    itemsTable: `${prefix}.MEAL_ITEMS`,
  }
}
