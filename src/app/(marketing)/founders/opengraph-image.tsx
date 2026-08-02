import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "For founders — iCapOS does the heavy lifting on investor outreach";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "For founders", title: "Keep running the company. We do the raise legwork.", tagline: "Readiness rating · matched investor list · materials distribution" }),
    { ...size },
  );
}
