"use client"

import { useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MealCapture } from "@/components/meal-capture"
import { MealList, TargetBar } from "@/components/meal-list"
import { ProfileForm } from "@/components/profile-form"
import { addDays, startOfDay, useMe, useMeals } from "@/lib/client"

export function HomeScreen() {
  const me = useMe()

  if (me.isPending) return <Skeleton className="h-40 w-full" />
  if (me.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{me.error.message}</AlertDescription>
      </Alert>
    )
  }

  if (!me.data.profileCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Créer mon profil</CardTitle>
          <CardDescription>
            Bienvenue sur Calorimètre. Votre compte est lié à votre connexion ; vos repas ne sont visibles que par vous.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm user={me.data} submitLabel="Créer mon profil" />
        </CardContent>
      </Card>
    )
  }

  return <Today target={me.data.dailyKcalTarget} name={me.data.displayName} />
}

function Today({ target, name }: { target: number; name: string }) {
  // Fixed at mount: the page picks up the new day when it is reopened after midnight.
  const from = useMemo(() => startOfDay(new Date()), [])
  const to = useMemo(() => addDays(from, 1), [from])
  const meals = useMeals(from, to)
  const kcal = meals.data?.reduce((acc, m) => acc + m.kcal, 0) ?? 0

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-lg font-semibold">Bonjour {name}</h1>
        {meals.isPending ? <Skeleton className="h-8 w-full" /> : <TargetBar kcal={kcal} target={target} />}
      </section>

      <MealCapture />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Aujourd’hui</h2>
        {meals.isPending && <Skeleton className="h-16 w-full" />}
        {meals.isError && (
          <Alert variant="destructive">
            <AlertDescription>{meals.error.message}</AlertDescription>
          </Alert>
        )}
        {meals.data && <MealList meals={meals.data} />}
      </section>
    </div>
  )
}
