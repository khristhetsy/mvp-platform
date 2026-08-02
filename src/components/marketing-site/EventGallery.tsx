import Image from "next/image";
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Event photo gallery (spec §12, §16). Data-driven from the filesystem: renders
 * whatever images sit in public/marketing/events/. Because the pages that use it
 * are statically rendered, the readdir runs at build/revalidate time (public/ is
 * present then), so this never touches the serverless FS at request time.
 *
 * Empty state = just the caption (identical to the pre-photo layout), so dropping
 * cleared, curated WebPs into the folder is all that's needed to light it up.
 * Images are lazy, sized via a fixed aspect box to avoid CLS (§12).
 */

const DIR = "public/marketing/events";
const IMG = /\.(webp|avif|jpe?g|png)$/i;

async function loadPhotos(): Promise<string[]> {
  try {
    const files = await readdir(path.join(process.cwd(), DIR));
    return files
      .filter((f) => IMG.test(f) && !f.startsWith("."))
      .sort()
      .map((f) => `/marketing/events/${f}`);
  } catch {
    return [];
  }
}

export async function EventGallery({ caption, max = 8 }: { caption?: string; max?: number }) {
  const photos = (await loadPhotos()).slice(0, max);

  if (photos.length === 0) {
    return caption ? <p className="mt-4 font-site-mono text-[11px] text-site-muted/70">{caption}</p> : null;
  }

  return (
    <figure className="mt-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((src) => (
          <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-site-line">
            <Image
              src={src}
              alt="iCFO Capital Global conference and networking session"
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      {caption ? <figcaption className="mt-3 font-site-mono text-[11px] text-site-muted/70">{caption}</figcaption> : null}
    </figure>
  );
}
