import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "For investors — rated deal flow at a volume you set";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "For investors", title: "Rated deal flow, at a volume you set.", tagline: "Free accounts · your mandate · your monthly cap · pledge-only" }),
    { ...size },
  );
}
