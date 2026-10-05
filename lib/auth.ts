/**
 * Application identity. Every route resolves the caller through getCurrentUser(), which
 * maps the authentication source (CALO_AUTH_MODE) to a row in APP_USERS and returns its
 * internal USER_ID. Data is keyed by USER_ID only, so a future "password" mode can be
 * added here without touching tables or routes.
 */

import { headers } from "next/headers"
import { querySnowflake } from "@/lib/snowflake"
import { getConfig, type AuthMode } from "@/lib/config"

export interface AppUser {
  userId: string
  displayName: string
  dailyKcalTarget: number
  profileCompleted: boolean
}

/** Thrown when the request carries no usable identity; routes turn it into a 401. */
export class UnauthenticatedError extends Error {
  constructor() {
    super("Non authentifié")
  }
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { user: AppUser; expiresAt: number }>()

/** Identity subject for the configured auth mode, or null when the request is anonymous. */
async function resolveSubject(mode: AuthMode): Promise<string | null> {
  // "snowflake": SPCS ingress authenticates the user and injects this header. Locally there
  // is no ingress, so development runs as a fixed "local" user.
  const user = (await headers()).get("sf-context-current-user")?.trim()
  if (user) return user
  return process.env.NODE_ENV === "development" ? "local" : null
}

function toUser(row: Record<string, any>): AppUser {
  return {
    userId: row.USER_ID,
    displayName: row.DISPLAY_NAME ?? "",
    dailyKcalTarget: Number(row.DAILY_KCAL_TARGET ?? 2000),
    profileCompleted: Boolean(row.PROFILE_COMPLETED),
  }
}

export async function getCurrentUser(): Promise<AppUser> {
  const { authMode, usersTable } = getConfig()
  const subject = await resolveSubject(authMode)
  if (!subject) throw new UnauthenticatedError()

  const key = `${authMode}:${subject}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.user

  // Create the account on first visit, otherwise record the login.
  await querySnowflake(
    `MERGE INTO ${usersTable} u
     USING (SELECT ? AS P, ? AS S) s ON u.AUTH_PROVIDER = s.P AND u.AUTH_SUBJECT = s.S
     WHEN MATCHED THEN UPDATE SET LAST_LOGIN_AT = CURRENT_TIMESTAMP()
     WHEN NOT MATCHED THEN INSERT (AUTH_PROVIDER, AUTH_SUBJECT, LAST_LOGIN_AT)
       VALUES (s.P, s.S, CURRENT_TIMESTAMP())`,
    { binds: [authMode, subject] },
  )
  const rows = await querySnowflake(
    `SELECT USER_ID, DISPLAY_NAME, DAILY_KCAL_TARGET, PROFILE_COMPLETED
       FROM ${usersTable} WHERE AUTH_PROVIDER = ? AND AUTH_SUBJECT = ?`,
    { binds: [authMode, subject] },
  )
  if (!rows[0]) throw new Error("Compte introuvable après création")

  const user = toUser(rows[0])
  cache.set(key, { user, expiresAt: Date.now() + CACHE_TTL_MS })
  return user
}

export async function updateProfile(
  userId: string,
  profile: { displayName: string; dailyKcalTarget: number },
): Promise<void> {
  const { usersTable } = getConfig()
  await querySnowflake(
    `UPDATE ${usersTable}
        SET DISPLAY_NAME = ?, DAILY_KCAL_TARGET = ?, PROFILE_COMPLETED = TRUE
      WHERE USER_ID = ?`,
    { binds: [profile.displayName, profile.dailyKcalTarget, userId] },
  )
  cache.clear()
}

/** Standard JSON error response; 401 for missing identity, 500 otherwise. */
export function errorResponse(scope: string, e: unknown): Response {
  if (e instanceof UnauthenticatedError) {
    return Response.json({ error: e.message }, { status: 401 })
  }
  console.error(new Date().toISOString(), `[${scope}] failed`, e)
  return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 })
}
