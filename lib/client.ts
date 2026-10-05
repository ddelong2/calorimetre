"use client"

/** Client-side data hooks shared by the screens. */

import { useQuery } from "@tanstack/react-query"
import type { AppUser } from "@/lib/auth"
import type { DayStat, Meal, MealDetail } from "@/lib/nutrition"

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`)
  return body as T
}

export function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Monday 00:00 of the week containing d (local time). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d)
  return addDays(x, -((x.getDay() + 6) % 7))
}

/** YYYY-MM-DD in local time. */
export function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => fetchJson<AppUser>("/api/me") })
}

export function useMeals(from: Date, to: Date) {
  return useQuery({
    queryKey: ["meals", from.toISOString(), to.toISOString()],
    queryFn: () =>
      fetchJson<Meal[]>(
        `/api/meals?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      ),
  })
}

export function useMeal(id: string | null) {
  return useQuery({
    queryKey: ["meal", id],
    queryFn: () => fetchJson<MealDetail>(`/api/meals/${encodeURIComponent(id!)}`),
    enabled: !!id,
  })
}

export function useStats(days: number) {
  return useQuery({
    queryKey: ["stats", days],
    queryFn: () => fetchJson<DayStat[]>(`/api/stats?days=${days}&tz=${encodeURIComponent(timeZone())}`),
  })
}
