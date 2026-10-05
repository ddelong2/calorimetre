import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Calorimètre",
    short_name: "Calorimètre",
    description: "Estimation des calories d'un repas à partir d'une photo",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#29b5e8",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  }
}
