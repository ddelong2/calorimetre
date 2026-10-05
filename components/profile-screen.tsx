"use client"

import { LogOut } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProfileForm } from "@/components/profile-form"
import { useMe } from "@/lib/client"

/** Snowflake ingress logout endpoint: ends the Snowflake session for this app. */
const LOGOUT_URL = "/sfc-endpoint/logout"

export function ProfileScreen() {
  const me = useMe()
  const [saved, setSaved] = useState(false)

  if (me.isPending) return <Skeleton className="h-60 w-full" />
  if (me.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{me.error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Profil</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mes informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ProfileForm
            key={me.dataUpdatedAt}
            user={me.data}
            submitLabel="Enregistrer"
            onSaved={() => setSaved(true)}
          />
          {saved && <p className="text-center text-sm text-muted-foreground">Profil enregistré.</p>}
        </CardContent>
      </Card>
      <Button variant="outline" className="w-full" asChild>
        <a href={LOGOUT_URL}>
          <LogOut className="size-4" /> Se déconnecter
        </a>
      </Button>
    </div>
  )
}
