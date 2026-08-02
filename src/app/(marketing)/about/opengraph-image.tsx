import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "About iCapOS — built by iCFO Capital Global";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "About", title: "Built to make private capital legible.", tagline: "iCapOS is a product of iCFO Capital Global, Inc." }),
    { ...size },
  );
}
