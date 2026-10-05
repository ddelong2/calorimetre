import { MealCapture } from "@/components/meal-capture"
import { MealHistory } from "@/components/meal-history"

// Required: Snowflake is not reachable during docker build.
export const dynamic = "force-dynamic"

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md space-y-8 px-4 py-6">
      <MealCapture />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          7 derniers jours
        </h2>
        <MealHistory />
      </section>
    </main>
  )
}
