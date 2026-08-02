import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "Capital Readiness Rating — free, structured, and scored on what investors screen for";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Capital Readiness Rating", title: "Know where you stand before investors do.", tagline: "Free · five dimensions · an ordered list of what to fix" }),
    { ...size },
  );
}
