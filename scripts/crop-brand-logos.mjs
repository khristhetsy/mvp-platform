/**
 * Crop official CapitalOS logo variants from a horizontal master asset.
 * Run: node scripts/crop-brand-logos.mjs [path/to/master.png]
 *
 * Writes public/capitalos-logo.png (full), capitalos-icon.png, capitalos-wordmark.png.
 */
import sharp from "sharp";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const src =
  process.argv[2] ??
  path.join(root, "public/capitalos-logo-source.png");

function regionBounds(data, width, channels, x0, y0, x1, y1) {
  let left = x1;
  let right = x0;
  let top = y1;
  let bottom = y0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a > 10 && (r < 250 || g < 250 || b < 250)) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }

  if (right < left) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

const full = regionBounds(data, width, channels, 0, 0, width, height);
if (!full) {
  throw new Error(`No logo content detected in ${src}`);
}

const icon = regionBounds(data, width, channels, 0, 0, Math.floor(width * 0.45), height);
const wordmark = regionBounds(data, width, channels, Math.floor(width * 0.38), 0, width, height);

if (!icon || !wordmark) {
  throw new Error("Could not detect icon or wordmark regions");
}

const outFull = path.join(root, "public/capitalos-logo.png");
const outIcon = path.join(root, "public/capitalos-icon.png");
const outWordmark = path.join(root, "public/capitalos-wordmark.png");

await sharp(src).extract(full).png({ compressionLevel: 9 }).toFile(outFull);
await sharp(src).extract(icon).png({ compressionLevel: 9 }).toFile(outIcon);
await sharp(src).extract(wordmark).png({ compressionLevel: 9 }).toFile(outWordmark);

console.log("Wrote", outFull, full);
console.log("Wrote", outIcon, icon);
console.log("Wrote", outWordmark, wordmark);
