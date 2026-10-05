import type { Metadata, Viewport } from "next"
import type React from "react"
import { AppHeader } from "@/components/app-header"
import { BottomNav } from "@/components/bottom-nav"
import { ThemeProvider } from "@/components/theme-provider"
import { QueryProvider } from "@/components/query-provider"
import { APP_TITLE, LOGO_SRC } from "@/lib/constants"
import "./globals.css"

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "Photographiez votre repas : identification des aliments et estimation des calories par Snowflake Cortex AI",
  icons: { icon: LOGO_SRC, apple: LOGO_SRC },
  appleWebApp: { capable: true, title: APP_TITLE, statusBarStyle: "default" },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#29b5e8",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="antialiased">
        <ThemeProvider>
          <QueryProvider>
            <AppHeader />
            <main className="mx-auto w-full max-w-md px-4 pt-6 pb-24">{children}</main>
            <BottomNav />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
