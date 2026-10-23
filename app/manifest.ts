import type { MetadataRoute } from "next";

// "Instalar app" (PLAN.md section 2: PWA via Next metadata). Icons come from
// app/icon.tsx; public/sw.js only serves the offline page.
// Colors match the dark theme (the default), so the app opens without a white flash.
// Screenshots make Chrome show its richer install sheet, like a store page.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Finanças",
    short_name: "Finanças",
    description:
      "Seu dinheiro em euro e real: quanto você tem agora, quanto vai sobrar no fim do mês, metas e câmbio.",
    lang: "pt-BR",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    categories: ["finance", "productivity"],
    background_color: "#0b1512",
    theme_color: "#0b1512",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon.
    shortcuts: [
      {
        name: "Novo lançamento",
        short_name: "Lançar",
        url: "/app?novo=1",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Câmbio",
        url: "/app/exchange",
        icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
      },
    ],
    screenshots: SCREENSHOTS,
  };
}

// Real screens with example data (public/screenshots). Phone-sized only: Chrome
// wants 320–3840 px and a long side at most 2.3× the short one.
const SCREENSHOTS: MetadataRoute.Manifest["screenshots"] = [
  ["inicio", "Quanto você tem agora e quanto vai sobrar"],
  ["lancamento", "Registre um gasto em segundos"],
  ["metas", "Quanto guardar por mês para cada meta"],
  ["cambio", "Euro e real lado a lado"],
].map(([name, label]) => ({
  src: `/screenshots/${name}.jpg`,
  sizes: "375x812",
  type: "image/jpeg",
  form_factor: "narrow" as const,
  label,
}));
