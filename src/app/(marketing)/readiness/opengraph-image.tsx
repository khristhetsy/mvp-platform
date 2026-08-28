import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "Capital Readiness Rating — investor-facing quality control, scored on what investors screen for";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Capital Readiness Rating", title: "Rated first — that's why the network opens.", tagline: "Investor-facing quality control · five dimensions · what to sharpen" }),
    { ...size },
  );
}
