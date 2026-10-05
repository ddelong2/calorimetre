"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, Camera, User } from "lucide-react"

const LINKS = [
  { href: "/", label: "Repas", icon: Camera },
  { href: "/historique", label: "Historique", icon: CalendarDays },
  { href: "/profil", label: "Profil", icon: User },
]

/** Mobile bottom navigation, padded for the iPhone home indicator. */
export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs ${active ? "text-primary font-medium" : "text-muted-foreground"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
