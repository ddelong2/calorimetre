import { beforeEach, describe, expect, it, vi } from "vitest"

const headerStore = new Map<string, string>()
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => headerStore.get(k) ?? null }),
}))

const querySnowflake = vi.fn()
vi.mock("../../lib/snowflake", () => ({ querySnowflake: (...a: unknown[]) => querySnowflake(...a) }))

const USER_ROW = { USER_ID: "u-1", DISPLAY_NAME: "Ana", DAILY_KCAL_TARGET: 1800, PROFILE_COMPLETED: true }

async function freshAuth() {
  vi.resetModules() // clears the module-level user cache
  return import("../../lib/auth")
}

describe("getCurrentUser", () => {
  beforeEach(() => {
    headerStore.clear()
    querySnowflake.mockReset()
    vi.unstubAllEnvs()
  })

  it("creates or refreshes the account from the Snowflake ingress header", async () => {
    headerStore.set("sf-context-current-user", "JDOE")
    querySnowflake.mockResolvedValueOnce([]).mockResolvedValueOnce([USER_ROW])
    const { getCurrentUser } = await freshAuth()

    const user = await getCurrentUser()

    expect(user).toEqual({ userId: "u-1", displayName: "Ana", dailyKcalTarget: 1800, profileCompleted: true })
    const [mergeSql, mergeOpts] = querySnowflake.mock.calls[0]
    expect(mergeSql).toMatch(/MERGE INTO .*APP_USERS/)
    expect(mergeOpts.binds).toEqual(["snowflake", "JDOE"])
  })

  it("caches the user between requests", async () => {
    headerStore.set("sf-context-current-user", "JDOE")
    querySnowflake.mockResolvedValueOnce([]).mockResolvedValueOnce([USER_ROW])
    const { getCurrentUser } = await freshAuth()

    await getCurrentUser()
    await getCurrentUser()

    expect(querySnowflake).toHaveBeenCalledTimes(2)
  })

  it("rejects requests without identity outside development", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const { getCurrentUser, UnauthenticatedError } = await freshAuth()

    await expect(getCurrentUser()).rejects.toBeInstanceOf(UnauthenticatedError)
    expect(querySnowflake).not.toHaveBeenCalled()
  })

  it("uses a fixed local user in development", async () => {
    vi.stubEnv("NODE_ENV", "development")
    querySnowflake.mockResolvedValueOnce([]).mockResolvedValueOnce([USER_ROW])
    const { getCurrentUser } = await freshAuth()

    await getCurrentUser()

    expect(querySnowflake.mock.calls[0][1].binds).toEqual(["snowflake", "local"])
  })
})

describe("errorResponse", () => {
  it("maps missing identity to 401", async () => {
    const { errorResponse, UnauthenticatedError } = await freshAuth()
    expect(errorResponse("t", new UnauthenticatedError()).status).toBe(401)
    expect(errorResponse("t", new Error("boom")).status).toBe(500)
  })
})
