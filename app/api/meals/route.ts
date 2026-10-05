/**
 * GET  /api/meals         — the current user's meals for the last 7 days.
 * POST /api/meals         — save a confirmed analysis (JSON: imagePath, analysis, portionFactor).
 * DELETE /api/meals?id=…  — delete one of the current user's meals.
 */

import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { currentUser } from "@/lib/user"
import { sumMacros, type Meal, type MealAnalysis } from "@/lib/nutrition"

export const dynamic = "force-dynamic"

function toIso(val: unknown): string {
  return val instanceof Date ? val.toISOString() : String(val)
}

export async function GET() {
  try {
    const { mealsTable } = getConfig()
    const rows = await querySnowflake(
      `SELECT ID, CREATED_AT, PLAT, PORTION_FACTOR, KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G, CONFIANCE
         FROM ${mealsTable}
        WHERE USER_NAME = ? AND CREATED_AT >= DATEADD(day, -7, CURRENT_TIMESTAMP())
        ORDER BY CREATED_AT DESC`,
      { binds: [await currentUser()] },
    )
    const meals: Meal[] = rows.map((r) => ({
      id: r.ID,
      createdAt: toIso(r.CREATED_AT),
      plat: r.PLAT,
      portionFactor: Number(r.PORTION_FACTOR),
      kcal: Number(r.KCAL),
      proteines: Number(r.PROTEINES_G),
      glucides: Number(r.GLUCIDES_G),
      lipides: Number(r.LIPIDES_G),
      confiance: r.CONFIANCE,
    }))
    return Response.json(meals)
  } catch (e) {
    console.error(new Date().toISOString(), "[meals] list failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      imagePath?: string
      analysis?: MealAnalysis
      portionFactor?: number
    }
    const { imagePath, analysis } = body
    const factor = Number(body.portionFactor ?? 1)
    if (!imagePath || !analysis || !Array.isArray(analysis.aliments)) {
      return Response.json({ error: "Requête invalide" }, { status: 400 })
    }
    if (!(factor >= 0.25 && factor <= 3)) {
      return Response.json({ error: "Facteur de portion hors limites" }, { status: 400 })
    }

    const { mealsTable } = getConfig()
    const totals = sumMacros(analysis.aliments, factor)
    await querySnowflake(
      `INSERT INTO ${mealsTable}
         (USER_NAME, IMAGE_PATH, PLAT, PORTION_FACTOR, KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G, CONFIANCE, ANALYSIS)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, PARSE_JSON(?)`,
      {
        binds: [
          await currentUser(),
          imagePath,
          analysis.plat,
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
    return Response.json({ ok: true })
  } catch (e) {
    console.error(new Date().toISOString(), "[meals] save failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id")
    if (!id) return Response.json({ error: "id manquant" }, { status: 400 })
    const { mealsTable } = getConfig()
    await querySnowflake(`DELETE FROM ${mealsTable} WHERE ID = ? AND USER_NAME = ?`, {
      binds: [id, await currentUser()],
    })
    return Response.json({ ok: true })
  } catch (e) {
    console.error(new Date().toISOString(), "[meals] delete failed", e)
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 })
  }
}
