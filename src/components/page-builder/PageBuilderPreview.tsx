import Image from "next/image";
import Link from "next/link";
import type { PageBlock, PreviewMode } from "@/lib/page-builder/types";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function BlockShell({
  block,
  children,
  previewMode,
}: Readonly<{ block: PageBlock; children: React.ReactNode; previewMode: PreviewMode }>) {
  if (!block.visible) return null;

  return (
    <div
      data-block-id={block.id}
      data-block-type={block.type}
      className={previewMode === "mobile" ? "px-4 py-4" : "px-6 py-5"}
    >
      {children}
    </div>
  );
}

export function PageBuilderBlockRenderer({
  block,
  previewMode = "desktop",
}: Readonly<{ block: PageBlock; previewMode?: PreviewMode }>) {
  switch (block.type) {
    case "hero":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            {asString(block.props.eyebrow) ? (
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--gold)]">
                {asString(block.props.eyebrow)}
              </p>
            ) : null}
            <h1
              className={`mt-2 font-semibold tracking-tight text-[var(--navy)] ${
                previewMode === "mobile" ? "text-2xl leading-tight" : "text-3xl md:text-4xl"
              }`}
            >
              {asString(block.props.headline) || "Hero headline"}
            </h1>
            {asString(block.props.subheadline) ? (
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                {asString(block.props.subheadline)}
              </p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {asString(block.props.primaryCtaLabel) ? (
                <Link href={asString(block.props.primaryCtaHref) || "#"} className="cap-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                  {asString(block.props.primaryCtaLabel)}
                </Link>
              ) : null}
              {asString(block.props.secondaryCtaLabel) ? (
                <Link
                  href={asString(block.props.secondaryCtaHref) || "#"}
                  className="cap-btn-secondary rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  {asString(block.props.secondaryCtaLabel)}
                </Link>
              ) : null}
            </div>
          </div>
        </BlockShell>
      );
    case "trust_badges": {
      const badges = Array.isArray(block.props.badges) ? block.props.badges.map(String) : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                {badge}
              </span>
            ))}
          </div>
        </BlockShell>
      );
    }
    case "feature_grid": {
      const items = Array.isArray(block.props.items)
        ? (block.props.items as Array<{ title?: string; body?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          {asString(block.props.title) ? (
            <h2 className="mb-3 text-lg font-semibold text-[var(--navy)]">{asString(block.props.title)}</h2>
          ) : null}
          <div className={`grid gap-3 ${previewMode === "mobile" ? "grid-cols-1" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
            {items.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
                <h3 className="text-sm font-semibold text-[var(--navy)]">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{item.body}</p>
              </article>
            ))}
          </div>
        </BlockShell>
      );
    }
    case "metrics_row": {
      const metrics = Array.isArray(block.props.metrics)
        ? (block.props.metrics as Array<{ label?: string; value?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className={`grid gap-3 ${previewMode === "mobile" ? "grid-cols-1" : "sm:grid-cols-3"}`}>
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">{metric.value}</p>
              </div>
            ))}
          </div>
        </BlockShell>
      );
    }
    case "cta_band":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-[var(--navy-muted)] p-5">
            <h2 className="text-lg font-semibold text-[var(--navy)]">{asString(block.props.title) || "CTA title"}</h2>
            {asString(block.props.body) ? <p className="mt-2 text-sm text-slate-600">{asString(block.props.body)}</p> : null}
            {asString(block.props.ctaLabel) ? (
              <Link href={asString(block.props.ctaHref) || "#"} className="cap-btn-primary mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold">
                {asString(block.props.ctaLabel)}
              </Link>
            ) : null}
          </div>
        </BlockShell>
      );
    case "text_section":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            {asString(block.props.eyebrow) ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gold)]">{asString(block.props.eyebrow)}</p>
            ) : null}
            {asString(block.props.title) ? (
              <h2 className="mt-1 text-xl font-semibold text-[var(--navy)]">{asString(block.props.title)}</h2>
            ) : null}
            {asString(block.props.body) ? (
              <p className="mt-2 text-sm leading-6 text-slate-600">{asString(block.props.body)}</p>
            ) : null}
          </div>
        </BlockShell>
      );
    case "image_banner":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[var(--shadow-panel)]">
            {asString(block.props.imageUrl) ? (
              <div className="relative flex min-h-[120px] items-center justify-center bg-[var(--surface-sunken)] p-6">
                <Image
                  src={asString(block.props.imageUrl)}
                  alt={asString(block.props.alt) || "Banner image"}
                  width={320}
                  height={80}
                  className="h-auto max-h-24 w-auto object-contain"
                />
              </div>
            ) : null}
            {asString(block.props.caption) ? (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{asString(block.props.caption)}</p>
            ) : null}
          </div>
        </BlockShell>
      );
    case "spacer": {
      const size = asString(block.props.size) || "md";
      const height = size === "sm" ? "h-4" : size === "lg" ? "h-16" : "h-8";
      return block.visible ? <div className={height} aria-hidden /> : null;
    }
    default:
      return null;
  }
}

export function PageBuilderPreview({
  blocks,
  previewMode = "desktop",
}: Readonly<{ blocks: PageBlock[]; previewMode?: PreviewMode }>) {
  return (
    <div
      className={`cap-marketing-surface overflow-hidden rounded-xl border border-slate-200/80 bg-[var(--background)] ${
        previewMode === "mobile" ? "mx-auto max-w-[390px]" : "w-full"
      }`}
    >
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-900">
        Lab preview only — production pages are unchanged in Phase 1.
      </div>
      {blocks.map((block) => (
        <PageBuilderBlockRenderer key={block.id} block={block} previewMode={previewMode} />
      ))}
    </div>
  );
}
