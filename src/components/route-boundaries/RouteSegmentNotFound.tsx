import Link from "next/link";

type RouteSegmentNotFoundProps = Readonly<{
  eyebrow: string;
  title?: string;
  description?: string;
  homeHref: string;
  homeLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}>;

export function RouteSegmentNotFound({
  eyebrow,
  title = "Page not found",
  description = "The page you're looking for doesn't exist or may have moved. Check the address or return to your workspace.",
  homeHref,
  homeLabel,
  secondaryHref,
  secondaryLabel,
}: RouteSegmentNotFoundProps) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-10 enterprise-animate-in lg:px-6">
      <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-panel)] lg:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--gold)]">{eyebrow}</p>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-slate-400">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 lg:text-[1.65rem]">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={homeHref}
            className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
          >
            {homeLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
