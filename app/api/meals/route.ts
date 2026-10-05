/**
 * GET  /api/meals?from=ISO&to=ISO — the current user's meals in [from, to), newest first
 *      (defaults to the last 7 days). Soft-deleted meals are excluded.
 * POST /api/meals — save a confirmed analysis
 *      (JSON: imagePath, analysis, portionFactor, mealType?, note?).
 */

import { randomUUID } from "crypto"
import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { errorResponse, getCurrentUser } from "@/lib/auth"
import { isMealType, MEAL_COLUMNS, toMeal } from "@/lib/meals"
import { sumMacros, type MealAnalysis } from "@/lib/nutrition"

export const dynamic = "force-dynamic"

const IMAGE_PATH = /^[A-Za-z0-9-]+\/[A-Za-z0-9-]+\.(jpg|png|webp)$/

function parseDate(value: string | null, fallback: Date): Date {
  const d = value ? new Date(value) : fallback
  return Number.isNaN(d.getTime()) ? fallback : d
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    const params = new URL(req.url).searchParams
    const now = new Date()
    const to = parseDate(params.get("to"), now)
    const from = parseDate(params.get("from"), new Date(to.getTime() - 7 * 86_400_000))

    const { mealsTable } = getConfig()
    const rows = await querySnowflake(
      `SELECT ${MEAL_COLUMNS} FROM ${mealsTable}
        WHERE USER_ID = ? AND DELETED_AT IS NULL
          AND CREATED_AT >= TO_TIMESTAMP_LTZ(?) AND CREATED_AT < TO_TIMESTAMP_LTZ(?)
        ORDER BY CREATED_AT DESC`,
      { binds: [user.userId, from.toISOString(), to.toISOString()] },
    )
    return Response.json(rows.map(toMeal))
  } catch (e) {
    return errorResponse("meals", e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = (await req.json()) as {
      imagePath?: string
      analysis?: MealAnalysis
      portionFactor?: number
      mealType?: unknown
      note?: unknown
    }
    const { imagePath, analysis } = body
    const factor = Number(body.portionFactor ?? 1)
    if (!imagePath || !IMAGE_PATH.test(imagePath) || !imagePath.startsWith(`${user.userId}/`)) {
      return Response.json({ error: "Photo invalide" }, { status: 400 })
    }
    if (!analysis || !Array.isArray(analysis.aliments)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 })
    }
    if (!(factor >= 0.25 && factor <= 3)) {
      return Response.json({ error: "Facteur de portion hors limites" }, { status: 400 })
    }
    const mealType = isMealType(body.mealType) ? body.mealType : null
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null

    const { mealsTable, itemsTable } = getConfig()
    const mealId = randomUUID()
    const totals = sumMacros(analysis.aliments, factor)
    await querySnowflake(
      `INSERT INTO ${mealsTable}
         (ID, USER_ID, IMAGE_PATH, PLAT, MEAL_TYPE, NOTE, PORTION_FACTOR,
          KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G, CONFIANCE, ANALYSIS)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?)`,
      {
        binds: [
          mealId,
          user.userId,
          imagePath,
          analysis.plat,
          mealType,
          note,
          factor,
          totals.kcal,
          totals.proteines,
          totals.glucides,
          totals.lipides,
          analysis.confiance,
          JSON.stringify(analysis),
        ],
      },
    )
    // Per-food rows, scaled by the chosen portion.
    await querySnowflake(
      `INSERT INTO ${itemsTable}
         (MEAL_ID, POSITION, NOM, PORTION_G, KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G)
       SELECT ?, f.INDEX, f.VALUE:nom::VARCHAR,
              f.VALUE:portion_g::FLOAT * ?, ROUND(f.VALUE:kcal::FLOAT * ?),
              f.VALUE:proteines_g::FLOAT * ?, f.VALUE:glucides_g::FLOAT * ?, f.VALUE:lipides_g::FLOAT * ?
         FROM TABLE(FLATTEN(input => PARSE_JSON(?))) f`,
      { binds: [mealId, factor, factor, factor, factor, factor, JSON.stringify(analysis.aliments)] },
    )
    return Response.json({ ok: true, id: mealId })
  } catch (e) {
    return errorResponse("meals", e)
  }
}
