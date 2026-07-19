import Link from "next/link";
import { marketplaceCopy } from "@/lib/marketplace/copy";

export function PrivateLaneCta() {
  const c = marketplaceCopy.privateCta;
  return (
    <div className="my-11 flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-[linear-gradient(120deg,#0A1A40_0%,#143A80_100%)] px-8 py-8 text-white">
      <div>
        <h3 className="mb-1.5 text-[19px] font-bold">{c.heading}</h3>
        <p className="max-w-[560px] text-[13.5px] leading-[1.6] text-white/80">{c.body}</p>
      </div>
      <Link
        href={c.ctaHref}
        className="shrink-0 rounded-[9px] bg-white px-5.5 py-3 text-[13px] font-semibold text-[#0A1A40] hover:opacity-90"
      >
        {c.ctaLabel}
      </Link>
    </div>
  );
}
