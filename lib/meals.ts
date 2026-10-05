/** Data access for meals: shared column list, row mapping and ownership checks. */

import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { MEAL_TYPES, type Meal, type MealType } from "@/lib/nutrition"

export const MEAL_COLUMNS = `ID, CREATED_AT, PLAT, MEAL_TYPE, NOTE, PORTION_FACTOR, KCAL,
  PROTEINES_G, GLUCIDES_G, LIPIDES_G, CONFIANCE, IMAGE_PATH`

export function isMealType(value: unknown): value is MealType {
  return typeof value === "string" && value in MEAL_TYPES
}

export function toIso(val: unknown): string {
  return val instanceof Date ? val.toISOString() : String(val)
}

export function toMeal(r: Record<string, any>): Meal {
  return {
    id: r.ID,
    createdAt: toIso(r.CREATED_AT),
    plat: r.PLAT,
    mealType: isMealType(r.MEAL_TYPE) ? r.MEAL_TYPE : null,
    note: r.NOTE ?? null,
    portionFactor: Number(r.PORTION_FACTOR),
    kcal: Number(r.KCAL),
    proteines: Number(r.PROTEINES_G),
    glucides: Number(r.GLUCIDES_G),
    lipides: Number(r.LIPIDES_G),
    confiance: r.CONFIANCE,
    hasPhoto: Boolean(r.IMAGE_PATH),
  }
}

/** One of the user's meals (including soft-deleted ones), or null if it is not theirs. */
export async function findOwnMeal(userId: string, mealId: string) {
  const { mealsTable } = getConfig()
  const rows = await querySnowflake(
    `SELECT ${MEAL_COLUMNS}, ANALYSIS:incertitudes AS INCERTITUDES, DELETED_AT
       FROM ${mealsTable} WHERE ID = ? AND USER_ID = ?`,
    { binds: [mealId, userId] },
  )
  return rows[0] ?? null
}

/** Validates an IANA time zone name sent by the browser; falls back to UTC. */
export function safeTimeZone(tz: string | null): string {
  if (!tz) return "UTC"
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz })
    return tz
  } catch {
    return "UTC"
  }
}
