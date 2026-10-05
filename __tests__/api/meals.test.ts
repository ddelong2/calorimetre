import { beforeEach, describe, expect, it, vi } from "vitest"

const querySnowflake = vi.fn()
vi.mock("../../lib/snowflake", () => ({ querySnowflake: (...a: unknown[]) => querySnowflake(...a) }))

const ME = { userId: "11111111-1111-1111-1111-111111111111", displayName: "Ana", dailyKcalTarget: 2000, profileCompleted: true }
vi.mock("../../lib/auth", async () => {
  const actual = await vi.importActual<typeof import("../../lib/auth")>("../../lib/auth")
  return { ...actual, getCurrentUser: async () => ME }
})

import { DELETE, PATCH } from "../../app/api/meals/[id]/route"
import { POST } from "../../app/api/meals/route"

const ctx = (id: string) => ({ params: Promise.resolve({ id }) })
const json = (body: unknown) =>
  new Request("http://x", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

const ANALYSIS = {
  plat: "Salade",
  aliments: [{ nom: "Laitue", portion_g: 100, kcal: 15, proteines_g: 1, glucides_g: 2, lipides_g: 0 }],
  total_kcal: 15, kcal_min: 10, kcal_max: 20, confiance: "elevee", incertitudes: [],
}

beforeEach(() => querySnowflake.mockReset())

describe("POST /api/meals", () => {
  it("refuses a photo stored under another user's folder", async () => {
    const res = await POST(json({ imagePath: "22222222-2222-2222-2222-222222222222/a.jpg", analysis: ANALYSIS }))
    expect(res.status).toBe(400)
    expect(querySnowflake).not.toHaveBeenCalled()
  })

  it("saves the meal and its items for the current user, scaled by portion", async () => {
    querySnowflake.mockResolvedValue([])
    const res = await POST(json({ imagePath: `${ME.userId}/a.jpg`, analysis: ANALYSIS, portionFactor: 2, mealType: "diner" }))

    expect(res.status).toBe(200)
    const [mealSql, mealOpts] = querySnowflake.mock.calls[0]
    expect(mealSql).toMatch(/INSERT INTO .*MEALS/)
    expect(mealOpts.binds[1]).toBe(ME.userId) // USER_ID
    expect(mealOpts.binds[4]).toBe("diner") // MEAL_TYPE
    expect(mealOpts.binds[7]).toBe(30) // KCAL = 15 x 2
    expect(querySnowflake.mock.calls[1][0]).toMatch(/INSERT INTO .*MEAL_ITEMS/)
  })
})

describe("DELETE /api/meals/[id]", () => {
  it("returns 404 for a meal the user does not own, without updating", async () => {
    querySnowflake.mockResolvedValueOnce([]) // findOwnMeal: no row for this user
    const res = await DELETE(new Request("http://x"), ctx("m-other"))

    expect(res.status).toBe(404)
    expect(querySnowflake).toHaveBeenCalledTimes(1)
    expect(querySnowflake.mock.calls[0][1].binds).toEqual(["m-other", ME.userId])
  })

  it("soft-deletes the user's own meal", async () => {
    querySnowflake.mockResolvedValueOnce([{ ID: "m-1" }]).mockResolvedValueOnce([])
    const res = await DELETE(new Request("http://x"), ctx("m-1"))

    expect(res.status).toBe(200)
    const [sql, opts] = querySnowflake.mock.calls[1]
    expect(sql).toMatch(/SET DELETED_AT = CURRENT_TIMESTAMP\(\)/)
    expect(sql).not.toMatch(/DELETE FROM/)
    expect(opts.binds).toEqual(["m-1", ME.userId])
  })
})

describe("PATCH /api/meals/[id]", () => {
  it("restores a soft-deleted meal", async () => {
    querySnowflake.mockResolvedValueOnce([{ ID: "m-1", DELETED_AT: new Date() }]).mockResolvedValueOnce([])
    const res = await PATCH(json({ restore: true }), ctx("m-1"))

    expect(res.status).toBe(200)
    expect(querySnowflake.mock.calls[1][0]).toMatch(/DELETED_AT = NULL/)
  })
})
