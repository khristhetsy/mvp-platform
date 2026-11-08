import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { home } from "@/content/home";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/marketing-site/app-links";
import { Reveal } from "@/components/marketing-site/Reveal";

/**
 * Homepage app promotion. Sits directly after the network figures and before "How it works".
 * Store badges link out only when the listing URL is set in app-links.ts; until then a badge
 * shows "Coming soon". The phone image links to Google Play (or /install while that is unset),
 * and the QR code encodes the Google Play link. Copy lives in content/home.ts.
 */

function StoreBadge({ href, small, name, label }: { href: string | null; small: string; name: string; label: string }) {
  const body = (
    <>
      <span className={`block text-[9px] uppercase leading-none tracking-wide ${href ? "text-white/75" : "font-bold text-site-amber"}`}>{href ? small : "Coming soon"}</span>
      <span className="block text-[15px] font-semibold leading-tight text-white">{name}</span>
    </>
  );
  const cls = "inline-flex items-center rounded-[9px] border border-white/30 bg-black px-4 py-2";
  if (!href) return <span className={`${cls} opacity-80`} aria-label={`${label}, coming soon`}>{body}</span>;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`${cls} transition-opacity hover:opacity-90`} aria-label={label}>{body}</a>;
}

export async function AppPromo() {
  const a = home.app;
  const qr = PLAY_STORE_URL ? await QRCode.toDataURL(PLAY_STORE_URL, { margin: 1, width: 224, color: { dark: "#0a1a40", light: "#ffffff" } }) : null;
  const shot = (
    <Image
      src="/marketing/app/app-screens.webp"
      alt="iCapOS app screens: dashboard, event match and investor matches"
      width={1100}
      height={733}
      sizes="(min-width: 768px) 520px, 100vw"
      className="block h-auto w-full mix-blend-multiply"
    />
  );
  return (
    <section className="bg-site-paper px-6 py-20" aria-labelledby="app-promo-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
        <Reveal>
          <p className="font-site-mono text-xs font-semibold uppercase tracking-[0.16em] text-site-blue">{a.eyebrow}</p>
          <h2 id="app-promo-title" className="mt-3 font-site-display text-3xl font-extrabold tracking-tight text-site-navy sm:text-4xl">{a.title}</h2>
          <p className="mt-4 max-w-xl text-lg leading-8 text-site-muted">{a.sub}</p>
          <ul className="mt-5 space-y-2">
            {a.points.map((pt) => (
              <li key={pt} className="flex gap-2 text-sm text-site-ink"><span className="text-site-blue"><i className="ti ti-check" aria-hidden="true" /></span>{pt}</li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <StoreBadge href={PLAY_STORE_URL} small="Get it on" name="Google Play" label="Get iCapOS on Google Play" />
            <StoreBadge href={APP_STORE_URL} small="Download on the" name="App Store" label="Download iCapOS on the App Store" />
            {qr && (
              <Image src={qr} alt="QR code for the iCapOS app on Google Play" width={56} height={56} unoptimized className="hidden rounded-md border border-site-line bg-white md:block" />
            )}
          </div>
          <p className="mt-3 text-[13px] text-site-muted">{a.installPrompt}{" "}
            <Link href={a.installLink.href} className="font-semibold text-site-blue underline hover:text-site-blue-hi">{a.installLink.label}</Link>
          </p>
          <p className="mt-5 max-w-lg font-site-mono text-[11px] leading-5 text-site-muted">{a.compliance}</p>
        </Reveal>
        {PLAY_STORE_URL ? (
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Get iCapOS on Google Play">{shot}</a>
        ) : (
          <Link href={a.installLink.href} aria-label={a.installLink.label}>{shot}</Link>
        )}
      </div>
    </section>
  );
}
