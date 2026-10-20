import { ImageResponse } from "next/og";
import { Mark } from "./icon";

// iOS rounds the corners itself, so the tile is square.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<Mark size={180} rounded={false} />, size);
}
