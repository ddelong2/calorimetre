"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Meal } from "@/lib/nutrition"

const dayFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" })
const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })

function groupByDay(meals: Meal[]) {
  const groups = new Map<string, Meal[]>()
  for (const m of meals) {
    const key = new Date(m.createdAt).toDateString()
    groups.set(key, [...(groups.get(key) ?? []), m])
  }
  return [...groups.values()]
}

export function MealHistory() {
  const queryClient = useQueryClient()
  const meals = useQuery({
    queryKey: ["meals"],
    queryFn: async (): Promise<Meal[]> => {
      const res = await fetch("/api/meals")
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`)
      return body
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/meals?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["meals"] }),
  })

  if (meals.isPending) return <Skeleton className="h-32 w-full" />
  if (meals.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{meals.error.message}</AlertDescription>
      </Alert>
    )
  }
  if (meals.data.length === 0) {
    return <p className="text-center text-sm text-muted-foreground">Aucun repas enregistré ces 7 derniers jours.</p>
  }

  return (
    <div className="space-y-3">
      {groupByDay(meals.data).map((day) => {
        const date = new Date(day[0].createdAt)
        const total = day.reduce((acc, m) => acc + m.kcal, 0)
        return (
          <Card key={date.toDateString()}>
            <CardHeader className="pb-2">
              <div className="flex items-baseline justify-between">
                <CardTitle className="text-base capitalize">{dayFormat.format(date)}</CardTitle>
                <span className="text-sm font-semibold tabular-nums text-primary">{total} kcal</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm">
                {day.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 py-2">
                    <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
                      {timeFormat.format(new Date(m.createdAt))}
                    </span>
                    <span className="flex-1 truncate">{m.plat}</span>
                    <span className="tabular-nums font-medium">{m.kcal}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Supprimer ${m.plat}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(m.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
