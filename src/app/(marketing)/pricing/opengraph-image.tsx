import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "iCapOS pricing: Basic $49 and Professional $199, both self-serve";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Plans & pricing", title: "Start free. Upgrade when investors are interested.", tagline: "Free due diligence report. Basic $49, Professional $199, Premium $1,000 by wire." }),
    { ...size },
  );
}
