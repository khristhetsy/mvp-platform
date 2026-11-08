import Image from "next/image";

/**
 * Banner at the top of the signed in Private Market. Same dark navy band as the
 * home page hero, with the "not a broker-dealer" line the public pages carry.
 */
export function PrivateMarketHero() {
  return (
    <section className="relative overflow-hidden bg-site-navy pb-16 text-white">
      <Image
        src="/marketing/banners/private-market-hero.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-right"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06102e]/60 via-[#06102e]/15 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl px-6 pb-4 pt-8">
        <p className="font-site-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7fb0ff]">● Signed in</p>
        <h1 className="mt-3 font-site-display text-4xl font-extrabold leading-[1.05] tracking-tight">
          The <span className="text-[#6ea8ff]">Private Market</span>
        </h1>
        <p className="mt-2 text-base text-[#c3d1ee]">Companies approved by iCapOS. Click a company for the one pager.</p>
      </div>
      <p className="relative border-t border-white/10 bg-[#06102e]/55 py-3 backdrop-blur-sm">
        <span className="mx-auto block max-w-6xl px-6 font-site-mono text-[11px] leading-relaxed text-[#9fb2d8]">
          iCapOS is a software platform. It is not a broker-dealer, funding portal, investment adviser, or placement agent, and it does not raise capital or guarantee funding.
        </span>
      </p>
    </section>
  );
}
