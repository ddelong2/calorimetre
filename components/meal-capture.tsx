"use client"

import { useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Camera, Check, Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { mealTypeForHour, MEAL_TYPES, sumMacros, type AnalyzeResponse, type MealType } from "@/lib/nutrition"

const MAX_DIMENSION = 1280
const PORTIONS = [
  { label: "Petite", factor: 0.75 },
  { label: "Normale", factor: 1 },
  { label: "Grande", factor: 1.25 },
]
const CONFIDENCE_LABEL: Record<string, string> = {
  faible: "Confiance faible",
  moyenne: "Confiance moyenne",
  elevee: "Confiance élevée",
}

/** Downscale and re-encode the photo as JPEG so uploads stay small and under model limits. */
async function resizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Conversion impossible"))), "image/jpeg", 0.85),
  )
}

async function readError(res: Response): Promise<string> {
  const body = await res.json().catch(() => ({}))
  return body.error ?? `Erreur ${res.status}`
}

export function MealCapture() {
  const inputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [preview, setPreview] = useState<string | null>(null)
  const [factor, setFactor] = useState(1)
  const [mealType, setMealType] = useState<MealType>(() => mealTypeForHour(new Date().getHours()))
  const [note, setNote] = useState("")
  const analyze = useMutation({
    mutationFn: async (file: File): Promise<AnalyzeResponse> => {
      const form = new FormData()
      form.append("image", await resizeImage(file), "repas.jpg")
      const res = await fetch("/api/analyze", { method: "POST", body: form })
      if (!res.ok) throw new Error(await readError(res))
      return res.json()
    },
  })

  const save = useMutation({
    mutationFn: async (result: AnalyzeResponse) => {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...result, portionFactor: factor, mealType, note }),
      })
      if (!res.ok) throw new Error(await readError(res))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] })
      queryClient.invalidateQueries({ queryKey: ["stats"] })
      reset()
    },
  })

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (preview) URL.revokeObjectURL(preview)
    setPreview(URL.createObjectURL(file))
    setFactor(1)
    setMealType(mealTypeForHour(new Date().getHours()))
    setNote("")
    save.reset()
    analyze.mutate(file)
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFactor(1)
    analyze.reset()
  }

  const result = analyze.data
  const totals = result ? sumMacros(result.analysis.aliments, factor) : null

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />

      {!preview && (
        <Button size="lg" className="w-full h-16 text-base" onClick={() => inputRef.current?.click()}>
          <Camera className="size-5" /> Photographier mon repas
        </Button>
      )}

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Repas" className="w-full max-h-72 object-cover rounded-lg border border-border" />
      )}

      {analyze.isPending && (
        <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Analyse en cours…
        </div>
      )}

      {analyze.isError && (
        <Alert variant="destructive">
          <AlertDescription>{analyze.error.message}</AlertDescription>
        </Alert>
      )}

      {result && totals && (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-lg leading-tight">{result.analysis.plat}</CardTitle>
              <Badge variant="secondary" className="shrink-0">
                {CONFIDENCE_LABEL[result.analysis.confiance] ?? result.analysis.confiance}
              </Badge>
            </div>
            <CardDescription>
              Estimation du modèle : {result.analysis.kcal_min}–{result.analysis.kcal_max} kcal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="text-center">
              <div className="text-5xl font-bold tracking-tight text-primary">{totals.kcal}</div>
              <div className="text-sm text-muted-foreground">kcal</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <Macro label="Protéines" value={totals.proteines} />
                <Macro label="Glucides" value={totals.glucides} />
                <Macro label="Lipides" value={totals.lipides} />
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Portion</div>
              <div className="grid grid-cols-3 gap-2">
                {PORTIONS.map((p) => (
                  <Button
                    key={p.label}
                    variant={factor === p.factor ? "default" : "outline"}
                    onClick={() => setFactor(p.factor)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={factor}
                onChange={(e) => setFactor(Number(e.target.value))}
                className="mt-3 w-full accent-[var(--primary)]"
                aria-label="Ajuster la portion"
              />
              <div className="text-center text-xs text-muted-foreground">× {factor.toFixed(2)}</div>
            </div>

            <ul className="divide-y divide-border text-sm">
              {result.analysis.aliments.map((a) => (
                <li key={a.nom} className="flex justify-between gap-3 py-2">
                  <span>
                    {a.nom}
                    <span className="text-muted-foreground"> · {Math.round(a.portion_g * factor)} g</span>
                  </span>
                  <span className="font-medium tabular-nums">{Math.round(a.kcal * factor)} kcal</span>
                </li>
              ))}
            </ul>

            {result.analysis.incertitudes.length > 0 && (
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer">Points d’incertitude</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {result.analysis.incertitudes.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="space-y-2">
              <div className="text-sm font-medium">Repas</div>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(MEAL_TYPES) as MealType[]).map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={mealType === t ? "default" : "outline"}
                    onClick={() => setMealType(t)}
                  >
                    {MEAL_TYPES[t]}
                  </Button>
                ))}
              </div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Note (optionnel)"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            {save.isError && (
              <Alert variant="destructive">
                <AlertDescription>{save.error.message}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={reset} disabled={save.isPending}>
                <RotateCcw className="size-4" /> Reprendre
              </Button>
              <Button onClick={() => save.mutate(result)} disabled={save.isPending}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview && analyze.isError && (
        <Button variant="outline" className="w-full" onClick={reset}>
          <RotateCcw className="size-4" /> Réessayer
        </Button>
      )}
    </div>
  )
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <div className="font-semibold tabular-nums">{value} g</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}
