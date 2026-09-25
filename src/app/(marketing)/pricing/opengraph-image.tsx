import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "iCapOS pricing: Basic $49 and Professional $199, both self-serve";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Plans & pricing", title: "Two self-serve plans. No sales call.", tagline: "Basic $49 and Professional $199, both self-serve" }),
    { ...size },
  );
}
