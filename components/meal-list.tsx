"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendJson, useMeal } from "@/lib/client"
import { MEAL_TYPES, type Meal } from "@/lib/nutrition"

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" })

/** Horizontal gauge of kcal eaten vs. the daily target; turns amber above 100 %. */
export function TargetBar({ kcal, target }: { kcal: number; target: number }) {
  const pct = target > 0 ? Math.round((kcal / target) * 100) : 0
  const over = pct > 100
  return (
    <div className="space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${over ? "bg-amber-500" : "bg-primary"}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{kcal} / {target} kcal</span>
        <span className={over ? "text-amber-600 font-medium" : ""}>{pct} %</span>
      </div>
    </div>
  )
}

/** List of meals; each row expands into its detail (photo, foods). Deletion is soft with undo. */
export function MealList({ meals }: { meals: Meal[] }) {
  const queryClient = useQueryClient()
  const [openId, setOpenId] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<Meal | null>(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["meals"] })
    queryClient.invalidateQueries({ queryKey: ["stats"] })
  }
  const remove = useMutation({
    mutationFn: (meal: Meal) => sendJson(`/api/meals/${encodeURIComponent(meal.id)}`, "DELETE"),
    onSuccess: (_d, meal) => {
      setDeleted(meal)
      setOpenId(null)
      refresh()
    },
  })
  const restore = useMutation({
    mutationFn: (meal: Meal) => sendJson(`/api/meals/${encodeURIComponent(meal.id)}`, "PATCH", { restore: true }),
    onSuccess: () => {
      setDeleted(null)
      refresh()
    },
  })

  return (
    <div className="space-y-2">
      {deleted && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <span className="truncate">« {deleted.plat} » supprimé</span>
          <Button size="sm" variant="outline" disabled={restore.isPending} onClick={() => restore.mutate(deleted)}>
            Annuler
          </Button>
        </div>
      )}
      {meals.length === 0 && <p className="py-2 text-sm text-muted-foreground">Aucun repas.</p>}
      <ul className="divide-y divide-border text-sm">
        {meals.map((m) => {
          const open = openId === m.id
          return (
            <li key={m.id} className="py-2">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => setOpenId(open ? null : m.id)}
                aria-expanded={open}
              >
                <span className="w-11 shrink-0 text-muted-foreground tabular-nums">
                  {timeFormat.format(new Date(m.createdAt))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{m.plat}</span>
                  {m.mealType && (
                    <span className="block text-xs text-muted-foreground">{MEAL_TYPES[m.mealType]}</span>
                  )}
                </span>
                <span className="font-medium tabular-nums">{m.kcal}</span>
                {open ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
              </button>
              {open && <MealDetailView meal={m} onDelete={() => remove.mutate(m)} deleting={remove.isPending} />}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function MealDetailView({ meal, onDelete, deleting }: { meal: Meal; onDelete: () => void; deleting: boolean }) {
  const detail = useMeal(meal.id)
  return (
    <div className="mt-3 space-y-3">
      {meal.hasPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/meals/${encodeURIComponent(meal.id)}/photo`}
          alt={meal.plat}
          loading="lazy"
          className="w-full max-h-56 rounded-md border border-border object-cover"
        />
      )}
      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="secondary">P {meal.proteines} g</Badge>
        <Badge variant="secondary">G {meal.glucides} g</Badge>
        <Badge variant="secondary">L {meal.lipides} g</Badge>
        <Badge variant="outline">Portion × {meal.portionFactor.toFixed(2)}</Badge>
      </div>
      {meal.note && <p className="text-muted-foreground italic">{meal.note}</p>}
      {detail.isPending && <Skeleton className="h-16 w-full" />}
      {detail.isError && (
        <Alert variant="destructive">
          <AlertDescription>{detail.error.message}</AlertDescription>
        </Alert>
      )}
      {detail.data && (
        <ul className="space-y-1 text-muted-foreground">
          {detail.data.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-2">
              <span>{i.nom} · {Math.round(i.portion_g)} g</span>
              <span className="tabular-nums">{i.kcal} kcal</span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="outline" size="sm" className="w-full" onClick={onDelete} disabled={deleting}>
        {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        Supprimer ce repas
      </Button>
    </div>
  )
}
