import { ImageResponse } from "next/og";
import { markDataUri } from "@/components/brand/mark";

// App icons drawn at build time from the same SVG as the in-app logo.
// "maskable" fills the square and pulls the rings into Android's safe zone.

const VARIANTS = {
  "192": { size: 192, rounded: true, inset: 0 },
  "512": { size: 512, rounded: true, inset: 0 },
  maskable: { size: 512, rounded: false, inset: 0.25 },
} as const;

export function generateImageMetadata() {
  return Object.entries(VARIANTS).map(([id, { size }]) => ({
    id,
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const { size, rounded, inset } = VARIANTS[(await id) as keyof typeof VARIANTS];
  return new ImageResponse(<Mark size={size} rounded={rounded} inset={inset} />, {
    width: size,
    height: size,
  });
}

export function Mark({
  size,
  rounded,
  inset = 0,
}: {
  size: number;
  rounded: boolean;
  inset?: number;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- next/og renders plain <img>
  return <img src={markDataUri({ rounded, inset })} width={size} height={size} alt="" />;
}
