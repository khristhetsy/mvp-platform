import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "iCapOS pricing — two self-serve founder plans; the readiness rating is free";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Plans & pricing", title: "Two self-serve plans. No sales call.", tagline: "The Capital Readiness Rating is free — you only pay to distribute" }),
    { ...size },
  );
}
