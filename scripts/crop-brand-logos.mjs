/**
 * Crop official CapitalOS logo variants from public/capitalos-logo.png.
 * Run: node scripts/crop-brand-logos.mjs
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src = path.join(root, "public/capitalos-logo.png");

function contentBounds(data, width, channels, top, bottom, threshold = 5) {
  let left = width;
  let right = 0;
  let yTop = bottom;
  let yBottom = top;

  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 10 && (r < 250 || g < 250 || b < 250)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < yTop) yTop = y;
        if (y > yBottom) yBottom = y;
      }
    }
  }

  return { left, top: yTop, width: right - left + 1, height: yBottom - yTop + 1 };
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

const icon = contentBounds(data, info.width, info.channels, 210, 560);
const wordmark = contentBounds(data, info.width, info.channels, 210, 753);

await sharp(src).extract(icon).png({ compressionLevel: 9 }).toFile(path.join(root, "public/capitalos-icon.png"));
await sharp(src)
  .extract(wordmark)
  .png({ compressionLevel: 9 })
  .toFile(path.join(root, "public/capitalos-wordmark.png"));

console.log("Wrote public/capitalos-icon.png", icon);
console.log("Wrote public/capitalos-wordmark.png", wordmark);
