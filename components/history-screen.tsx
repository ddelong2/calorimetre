"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MealList, TargetBar } from "@/components/meal-list"
import { addDays, dayKey, startOfWeek, useMe, useMeals, useStats } from "@/lib/client"
import type { Meal } from "@/lib/nutrition"

const CHART_DAYS = 30
const dayTitle = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })
const shortDay = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" })

export function HistoryScreen() {
  const me = useMe()
  const target = me.data?.dailyKcalTarget ?? 2000

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Historique</h1>
      <ThirtyDayChart target={target} />
      <WeekView target={target} />
    </div>
  )
}

function ThirtyDayChart({ target }: { target: number }) {
  const stats = useStats(CHART_DAYS)

  // One bar per calendar day, including days without meals.
  const data = useMemo(() => {
    const byDay = new Map((stats.data ?? []).map((s) => [s.day, s.kcal]))
    const today = new Date()
    return Array.from({ length: CHART_DAYS }, (_, i) => {
      const d = addDays(today, i - CHART_DAYS + 1)
      return { day: shortDay.format(d), kcal: byDay.get(dayKey(d)) ?? 0 }
    })
  }, [stats.data])

  const tracked = data.filter((d) => d.kcal > 0)
  const average = tracked.length ? Math.round(tracked.reduce((a, d) => a + d.kcal, 0) / tracked.length) : 0

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">30 derniers jours</CardTitle>
        <p className="text-xs text-muted-foreground">
          {tracked.length
            ? `Moyenne ${average} kcal sur ${tracked.length} ${tracked.length > 1 ? "jours suivis" : "jour suivi"} · objectif ${target}`
            : "Aucun repas enregistré sur la période."}
        </p>
      </CardHeader>
      <CardContent>
        {stats.isPending && <Skeleton className="h-40 w-full" />}
        {stats.isError && (
          <Alert variant="destructive">
            <AlertDescription>{stats.error.message}</AlertDescription>
          </Alert>
        )}
        {stats.data && (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval={6} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, (max: number) => Math.max(max, target) * 1.1]}
                  tickFormatter={(v: number) => String(Math.round(v))}
                />
                <Tooltip
                  formatter={(v) => [`${v} kcal`, ""]}
                  separator=""
                  contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", fontSize: 12 }}
                />
                <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
                <Bar dataKey="kcal" radius={[3, 3, 0, 0]}>
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.kcal > target ? "#f59e0b" : "var(--primary)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WeekView({ target }: { target: number }) {
  const [offset, setOffset] = useState(0) // 0 = current week, -1 = last week, ...
  const from = useMemo(() => addDays(startOfWeek(new Date()), offset * 7), [offset])
  const to = useMemo(() => addDays(from, 7), [from])
  const meals = useMeals(from, to)

  const days = useMemo(() => {
    const groups = new Map<string, Meal[]>()
    for (const m of meals.data ?? []) {
      const key = dayKey(new Date(m.createdAt))
      groups.set(key, [...(groups.get(key) ?? []), m])
    }
    // Most recent day first, only days with meals.
    return Array.from({ length: 7 }, (_, i) => addDays(from, 6 - i))
      .map((d) => ({ date: d, meals: groups.get(dayKey(d)) ?? [] }))
      .filter((d) => d.meals.length > 0)
  }, [meals.data, from])

  const weekTotal = (meals.data ?? []).reduce((a, m) => a + m.kcal, 0)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" aria-label="Semaine précédente" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="text-center">
          <div className="text-sm font-medium">
            {offset === 0 ? "Cette semaine" : `Semaine du ${shortDay.format(from)}`}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {shortDay.format(from)} – {shortDay.format(addDays(to, -1))} · {weekTotal} kcal
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="Semaine suivante"
          disabled={offset >= 0}
          onClick={() => setOffset(offset + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {meals.isPending && <Skeleton className="h-32 w-full" />}
      {meals.isError && (
        <Alert variant="destructive">
          <AlertDescription>{meals.error.message}</AlertDescription>
        </Alert>
      )}
      {meals.data && days.length === 0 && (
        <p className="py-4 text-center text-sm text-muted-foreground">Aucun repas cette semaine.</p>
      )}
      {days.map(({ date, meals: dayMeals }) => (
        <Card key={dayKey(date)}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base capitalize">{dayTitle.format(date)}</CardTitle>
            <TargetBar kcal={dayMeals.reduce((a, m) => a + m.kcal, 0)} target={target} />
          </CardHeader>
          <CardContent>
            <MealList meals={dayMeals} />
          </CardContent>
        </Card>
      ))}
    </section>
  )
}
