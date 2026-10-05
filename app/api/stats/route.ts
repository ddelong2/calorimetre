/**
 * GET /api/stats?days=30&tz=Europe/Paris — daily kcal totals for the current user over the
 * last `days` days, grouped by calendar day in the given time zone. Days without meals are omitted.
 */

import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { errorResponse, getCurrentUser } from "@/lib/auth"
import { safeTimeZone } from "@/lib/meals"
import type { DayStat } from "@/lib/nutrition"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    const params = new URL(req.url).searchParams
    const days = Math.min(Math.max(Number(params.get("days")) || 30, 1), 365)
    const tz = safeTimeZone(params.get("tz"))

    const { mealsTable } = getConfig()
    const rows = await querySnowflake(
      `SELECT TO_CHAR(CONVERT_TIMEZONE(?, CREATED_AT)::DATE, 'YYYY-MM-DD') AS DAY,
              SUM(KCAL) AS KCAL, COUNT(*) AS MEALS
         FROM ${mealsTable}
        WHERE USER_ID = ? AND DELETED_AT IS NULL
          AND CREATED_AT >= DATEADD(day, -?, CURRENT_TIMESTAMP())
        GROUP BY 1 ORDER BY 1`,
      { binds: [tz, user.userId, days] },
    )
    const stats: DayStat[] = rows.map((r) => ({ day: r.DAY, kcal: Number(r.KCAL), meals: Number(r.MEALS) }))
    return Response.json(stats)
  } catch (e) {
    return errorResponse("stats", e)
  }
}
