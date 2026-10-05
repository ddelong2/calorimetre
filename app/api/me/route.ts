/**
 * GET /api/me — the current user's account (created on first visit).
 * PUT /api/me — update the profile (JSON: displayName, dailyKcalTarget).
 */

import { errorResponse, getCurrentUser, updateProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return Response.json(await getCurrentUser())
  } catch (e) {
    return errorResponse("me", e)
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser()
    const body = (await req.json()) as { displayName?: unknown; dailyKcalTarget?: unknown }
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : ""
    const target = Number(body.dailyKcalTarget)
    if (!displayName || displayName.length > 60) {
      return Response.json({ error: "Prénom requis (60 caractères max.)" }, { status: 400 })
    }
    if (!Number.isInteger(target) || target < 800 || target > 6000) {
      return Response.json({ error: "Objectif entre 800 et 6000 kcal" }, { status: 400 })
    }
    await updateProfile(user.userId, { displayName, dailyKcalTarget: target })
    return Response.json(await getCurrentUser())
  } catch (e) {
    return errorResponse("me", e)
  }
}
