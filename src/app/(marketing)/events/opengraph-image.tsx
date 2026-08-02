import { ImageResponse } from "next/og";
import { BrandOg, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/marketing-site/og";

export const alt = "iCFO events — expos and conferences where matched founders meet investors";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    BrandOg({ eyebrow: "iCFO events", title: "Where matched founders meet investors in person.", tagline: "Expos and conferences across the iCFO Capital network" }),
    { ...size },
  );
}
