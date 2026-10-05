/**
 * GET /api/meals/[id]/photo — the meal's photo, streamed from the stage.
 * Served by the app (not a presigned URL) because the SPCS proxy's CSP only allows same-origin images.
 */

import { randomUUID } from "crypto"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { querySnowflake } from "@/lib/snowflake"
import { getConfig } from "@/lib/config"
import { errorResponse, getCurrentUser } from "@/lib/auth"
import { findOwnMeal } from "@/lib/meals"

export const dynamic = "force-dynamic"

const IMAGE_PATH = /^[A-Za-z0-9_-]+\/[A-Za-z0-9-]+\.(jpg|png|webp)$/
const CONTENT_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let tmpDir: string | null = null
  try {
    const user = await getCurrentUser()
    const { id } = await params
    const row = await findOwnMeal(user.userId, id)
    const imagePath: string | undefined = row?.IMAGE_PATH
    if (!imagePath || !IMAGE_PATH.test(imagePath)) {
      return Response.json({ error: "Photo introuvable" }, { status: 404 })
    }

    // imagePath is validated above, so it is safe to inline in GET.
    const { stage } = getConfig()
    tmpDir = path.join(/*turbopackIgnore: true*/ os.tmpdir(), randomUUID())
    await fs.mkdir(tmpDir)
    await querySnowflake(`GET '${stage}/${imagePath}' 'file://${tmpDir}/'`)

    const fileName = imagePath.split("/")[1]
    const data = await fs.readFile(path.join(/*turbopackIgnore: true*/ tmpDir, fileName))
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": CONTENT_TYPES[fileName.split(".")[1]],
        "cache-control": "private, max-age=86400",
      },
    })
  } catch (e) {
    return errorResponse("photo", e)
  } finally {
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}
