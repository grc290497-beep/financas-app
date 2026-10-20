import { ImageResponse } from "next/og";

// App icons drawn at build time: a rounded tile with a euro and a real sign.
// "maskable" fills the square and keeps the glyphs inside Android's safe zone.
// shortcut: placeholder mark until the design pass picks a real one.

const VARIANTS = {
  "192": { size: 192, rounded: true },
  "512": { size: 512, rounded: true },
  maskable: { size: 512, rounded: false },
} as const;

export function generateImageMetadata() {
  return Object.entries(VARIANTS).map(([id, { size }]) => ({
    id,
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const { size, rounded } = VARIANTS[(await id) as keyof typeof VARIANTS];
  return new ImageResponse(<Mark size={size} rounded={rounded} />, {
    width: size,
    height: size,
  });
}

export function Mark({ size, rounded }: { size: number; rounded: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // --hero → --hero-2 from globals.css, in sRGB for next/og.
        background: "linear-gradient(135deg, #2e0a4f, #6a14a8)",
        color: "#fafafa",
        borderRadius: rounded ? size * 0.22 : 0,
        fontSize: size * (rounded ? 0.34 : 0.26),
        fontWeight: 700,
        letterSpacing: -size * 0.01,
      }}
    >
      €R$
    </div>
  );
}
