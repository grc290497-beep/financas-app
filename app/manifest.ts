import type { MetadataRoute } from "next";

// "Adicionar à tela inicial" (PLAN.md section 2: PWA via Next metadata).
// Icons come from app/icon.tsx; no service worker, the app needs the network.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Finanças",
    short_name: "Finanças",
    description: "Controle suas finanças pessoais em euro e real.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f2",
    theme_color: "#f4f6f2",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
