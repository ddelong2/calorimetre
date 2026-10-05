/**
 * POST /api/analyze — multipart form with an `image` field.
 * Uploads the photo to the stage, runs AI_COMPLETE vision on it and returns the
 * structured analysis. Nothing is saved to MEALS until the user confirms (POST /api/meals).
 */

import { randomUUID } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { querySnowflake, querySnowflakeLongRunning } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { errorResponse, getCurrentUser } from "@/lib/auth"
import { ANALYSIS_PROMPT, RESPONSE_FORMAT_SQL, type MealAnalysis } from "@/lib/nutrition"

export const dynamic = "force-dynamic"

const MAX_BYTES = 3_500_000 // Claude vision models reject images over 3.75 MB
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
}

export async function POST(req: Request) {
  let tmpFile: string | null = null
  try {
    const user = await getCurrentUser()
    const form = await req.formData()
    const image = form.get("image")
    if (!(image instanceof File)) {
      return Response.json({ error: "Aucune image reçue" }, { status: 400 })
    }
    const ext = EXTENSIONS[image.type]
    if (!ext) {
      return Response.json({ error: `Format non supporté : ${image.type}` }, { status: 400 })
    }
    if (image.size > MAX_BYTES) {
      return Response.json({ error: "Image trop volumineuse (max 3,5 Mo)" }, { status: 400 })
    }

    const { model, stage } = getConfig()
    // Photos live under the user's internal id (a UUID), never under a user-supplied name.
    const userFolder = user.userId.replace(/[^A-Za-z0-9-]/g, "")
    const fileName = `${randomUUID()}.${ext}`
    const relativePath = `${userFolder}/${fileName}`

    // File and folder names are server-generated and sanitized above, so they are safe to inline in PUT.
    tmpFile = path.join(/*turbopackIgnore: true*/ os.tmpdir(), fileName)
    await fs.writeFile(tmpFile, Buffer.from(await image.arrayBuffer()))
    await querySnowflake(
      `PUT 'file://${tmpFile}' '${stage}/${userFolder}/' AUTO_COMPRESS = FALSE OVERWRITE = TRUE`,
    )

    const rows = await querySnowflakeLongRunning(
      `SELECT TO_JSON(AI_COMPLETE(
         '${model}', ?, TO_FILE('${stage}', ?), {'temperature': 0}, ${RESPONSE_FORMAT_SQL}
       )) AS ANALYSIS`,
      { binds: [ANALYSIS_PROMPT, relativePath], pollIntervalMs: 1000, maxWaitMs: 120_000 },
    )
    const analysis = JSON.parse(rows[0]?.ANALYSIS ?? "null") as MealAnalysis | null
    if (!analysis) throw new Error("Réponse vide du modèle")

    return Response.json({ imagePath: relativePath, analysis })
  } catch (e) {
    return errorResponse("analyze", e)
  } finally {
    if (tmpFile) await fs.rm(tmpFile, { force: true }).catch(() => {})
  }
}
