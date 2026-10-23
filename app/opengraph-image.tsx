import { ImageResponse } from "next/og";
import { Mark } from "./icon";

// The preview shown when the site's link is shared (WhatsApp, Telegram, e-mail).
// Plain hex colors: next/og does not read the app's oklch CSS variables.
export const alt = "Finanças: seu dinheiro em euro e real, sem planilha";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "linear-gradient(135deg, #0f2a22 0%, #1d4a3b 100%)",
        color: "#f1f5ef",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <Mark size={72} rounded />
        <span style={{ fontSize: 40, fontWeight: 600 }}>Finanças</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <span style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05, color: "#ead9a0" }}>
          Seu dinheiro em euro e real, sem planilha
        </span>
        <span style={{ fontSize: 30, color: "#c4d6cc" }}>
          Disponível agora, sobra do mês, metas e câmbio num app só.
        </span>
      </div>
    </div>,
    size,
  );
}
