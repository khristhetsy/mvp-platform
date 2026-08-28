import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "iCapOS pricing — investor relations from iCFO Capital; paid plans from $499/mo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "Plans & pricing", title: "Get in front of matched investors.", tagline: "Investor relations from iCFO Capital · paid plans from $499/mo" }),
    { ...size },
  );
}
