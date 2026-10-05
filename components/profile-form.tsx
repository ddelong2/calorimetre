"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { sendJson } from "@/lib/client"
import type { AppUser } from "@/lib/auth"

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

/** Create-or-edit form for the user's profile (first name + daily kcal target). */
export function ProfileForm({ user, submitLabel, onSaved }: {
  user: AppUser
  submitLabel: string
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState(user.displayName)
  const [target, setTarget] = useState(String(user.dailyKcalTarget))

  const save = useMutation({
    mutationFn: () =>
      sendJson<AppUser>("/api/me", "PUT", { displayName, dailyKcalTarget: Number(target) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["me"], updated)
      onSaved?.()
    },
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      <label className="block space-y-1">
        <span className="text-sm font-medium">Prénom</span>
        <input
          className={inputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
          required
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Objectif journalier (kcal)</span>
        <input
          className={inputClass}
          type="number"
          inputMode="numeric"
          min={800}
          max={6000}
          step={50}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          required
        />
        <span className="text-xs text-muted-foreground">
          Repère courant : environ 2000 kcal pour une femme, 2500 pour un homme. Ajustez selon vos objectifs.
        </span>
      </label>
      {save.isError && (
        <Alert variant="destructive">
          <AlertDescription>{save.error.message}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={save.isPending}>
        {save.isPending && <Loader2 className="size-4 animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  )
}
