/**
 * GET    /api/meals/[id] — meal detail with per-food items.
 * PATCH  /api/meals/[id] — update (JSON: mealType?, note?, restore?: true to undo a delete).
 * DELETE /api/meals/[id] — soft delete (sets DELETED_AT; history is kept).
 */

import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { errorResponse, getCurrentUser } from "@/lib/auth"
import { findOwnMeal, isMealType, toMeal } from "@/lib/meals"
import type { MealDetail } from "@/lib/nutrition"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const notFound = () => Response.json({ error: "Repas introuvable" }, { status: 404 })

/** VARIANT arrays come back from the driver either parsed or as JSON text. */
function parseList(value: unknown): string[] {
  const list = typeof value === "string" ? JSON.parse(value) : value
  return Array.isArray(list) ? list.map(String) : []
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const row = await findOwnMeal(user.userId, id)
    if (!row || row.DELETED_AT) return notFound()

    const { itemsTable } = getConfig()
    const items = await querySnowflake(
      `SELECT NOM, PORTION_G, KCAL, PROTEINES_G, GLUCIDES_G, LIPIDES_G
         FROM ${itemsTable} WHERE MEAL_ID = ? ORDER BY POSITION`,
      { binds: [id] },
    )
    const detail: MealDetail = {
      ...toMeal(row),
      items: items.map((i) => ({
        nom: i.NOM,
        portion_g: Number(i.PORTION_G),
        kcal: Number(i.KCAL),
        proteines_g: Number(i.PROTEINES_G),
        glucides_g: Number(i.GLUCIDES_G),
        lipides_g: Number(i.LIPIDES_G),
      })),
      incertitudes: parseList(row.INCERTITUDES),
    }
    return Response.json(detail)
  } catch (e) {
    return errorResponse("meal", e)
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const row = await findOwnMeal(user.userId, id)
    if (!row) return notFound()

    const body = (await req.json()) as { mealType?: unknown; note?: unknown; restore?: unknown }
    const sets: string[] = []
    const binds: (string | null)[] = []
    if (body.mealType !== undefined) {
      sets.push("MEAL_TYPE = ?")
      binds.push(isMealType(body.mealType) ? body.mealType : null)
    }
    if (body.note !== undefined) {
      sets.push("NOTE = ?")
      binds.push(typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 500) : null)
    }
    if (body.restore === true) sets.push("DELETED_AT = NULL")
    if (sets.length === 0) return Response.json({ error: "Rien à modifier" }, { status: 400 })

    const { mealsTable } = getConfig()
    await querySnowflake(
      `UPDATE ${mealsTable} SET ${sets.join(", ")} WHERE ID = ? AND USER_ID = ?`,
      { binds: [...binds, id, user.userId] },
    )
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse("meal", e)
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const row = await findOwnMeal(user.userId, id)
    if (!row) return notFound()

    const { mealsTable } = getConfig()
    await querySnowflake(
      `UPDATE ${mealsTable} SET DELETED_AT = CURRENT_TIMESTAMP()
        WHERE ID = ? AND USER_ID = ? AND DELETED_AT IS NULL`,
      { binds: [id, user.userId] },
    )
    return Response.json({ ok: true })
  } catch (e) {
    return errorResponse("meal", e)
  }
}
