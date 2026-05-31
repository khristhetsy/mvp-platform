import Image from "next/image";
import Link from "next/link";
import {
  BarChart3,
  Check,
  FileText,
  Lock,
  Rocket,
  Shield,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { isComplianceNoticeStyle, isProcessStepIcon } from "@/lib/page-builder/content-rules";
import { getLayoutRegionDescriptors, getRegionBlocks, isLayoutBlockType } from "@/lib/page-builder/layout-blocks";
import type { PageBlock, PreviewMode } from "@/lib/page-builder/types";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

const STEP_ICON_MAP: Record<string, LucideIcon> = {
  check: Check,
  shield: Shield,
  rocket: Rocket,
  users: Users,
  "file-text": FileText,
  chart: BarChart3,
  lock: Lock,
  sparkles: Sparkles,
};

function StepIcon({ name }: Readonly<{ name: string }>) {
  const Icon = isProcessStepIcon(name) ? STEP_ICON_MAP[name] : Check;
  return <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />;
}

function StarRating({ rating }: Readonly<{ rating: number }>) {
  const count = Math.max(0, Math.min(5, Math.round(rating)));
  if (count === 0) return null;
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" aria-hidden />
      ))}
    </div>
  );
}

function BlockShell({
  block,
  children,
  previewMode,
  nested = false,
}: Readonly<{ block: PageBlock; children: React.ReactNode; previewMode: PreviewMode; nested?: boolean }>) {
  if (!block.visible) return null;

  const shellClass = nested ? "px-0 py-0" : previewMode === "mobile" ? "px-4 py-4" : "px-6 py-5";

  return (
    <div data-block-id={block.id} data-block-type={block.type} className={shellClass}>
      {children}
    </div>
  );
}

function LayoutRegionsPreview({
  block,
  previewMode,
}: Readonly<{ block: PageBlock; previewMode: PreviewMode }>) {
  const regions = getLayoutRegionDescriptors(block);
  const isMobile = previewMode === "mobile";

  const gridClass =
    block.type === "columns_3"
      ? isMobile
        ? "grid grid-cols-1 gap-4"
        : "grid grid-cols-1 gap-4 md:grid-cols-3"
      : block.type === "sidebar_layout"
        ? isMobile
          ? "grid grid-cols-1 gap-4"
          : "grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]"
        : block.type === "metric_grid"
          ? isMobile
            ? "grid grid-cols-1 gap-3"
            : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          : isMobile
            ? "grid grid-cols-1 gap-4"
            : "grid grid-cols-1 gap-4 md:grid-cols-2";

  if (block.type === "metric_grid") {
    const children = getRegionBlocks(block, "items");
    return (
      <div className={gridClass}>
        {children.map((child) => (
          <PageBuilderBlockRenderer key={child.id} block={child} previewMode={previewMode} nested />
        ))}
      </div>
    );
  }

  return (
    <div className={gridClass}>
      {regions.map((region) => {
        const children = getRegionBlocks(block, region.key);
        return (
          <div key={region.key} className="min-w-0 space-y-3">
            {block.type !== "metric_grid" && children.length > 0 ? (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{region.label}</p>
            ) : null}
            {children.map((child) => (
              <PageBuilderBlockRenderer key={child.id} block={child} previewMode={previewMode} nested />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function PageBuilderBlockRenderer({
  block,
  previewMode = "desktop",
  nested = false,
}: Readonly<{ block: PageBlock; previewMode?: PreviewMode; nested?: boolean }>) {
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
    case "testimonial":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <figure className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            {typeof block.props.rating === "number" && block.props.rating > 0 ? (
              <div className="mb-3">
                <StarRating rating={Number(block.props.rating)} />
              </div>
            ) : null}
            <blockquote className="text-sm leading-6 text-slate-700">
              &ldquo;{asString(block.props.quote) || "Testimonial quote"}&rdquo;
            </blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {asString(block.props.avatarUrl) ? (
                <Image
                  src={asString(block.props.avatarUrl)}
                  alt={asString(block.props.avatarAlt) || asString(block.props.name) || "Avatar"}
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--navy-muted)] text-xs font-semibold text-[var(--navy)]">
                  {asString(block.props.name).slice(0, 1) || "?"}
                </span>
              )}
              <div>
                <p className="text-sm font-semibold text-[var(--navy)]">{asString(block.props.name) || "Name"}</p>
                <p className="text-xs text-slate-500">{asString(block.props.title) || "Title / company"}</p>
              </div>
            </figcaption>
          </figure>
        </BlockShell>
      );
    case "faq": {
      const items = Array.isArray(block.props.items)
        ? (block.props.items as Array<{ question?: string; answer?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            <h2 className="text-lg font-semibold text-[var(--navy)]">{asString(block.props.title) || "FAQ"}</h2>
            <dl className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={item.question} className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] px-3 py-2.5">
                  <dt className="text-sm font-semibold text-[var(--navy)]">{item.question}</dt>
                  <dd className="mt-1 text-xs leading-5 text-slate-600">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </div>
        </BlockShell>
      );
    }
    case "process_steps": {
      const steps = Array.isArray(block.props.steps)
        ? (block.props.steps as Array<{ icon?: string; title?: string; description?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            <h2 className="text-lg font-semibold text-[var(--navy)]">{asString(block.props.title) || "Process"}</h2>
            {asString(block.props.subtitle) ? (
              <p className="mt-1 text-sm text-slate-600">{asString(block.props.subtitle)}</p>
            ) : null}
            <ol className={`mt-4 grid gap-3 ${previewMode === "mobile" ? "grid-cols-1" : "sm:grid-cols-3"}`}>
              {steps.map((step, index) => (
                <li key={`${step.title}-${index}`} className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--navy)] text-white">
                      <StepIcon name={asString(step.icon) || "check"} />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gold)]">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-[var(--navy)]">{step.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{step.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </BlockShell>
      );
    }
    case "pricing_plan": {
      const features = Array.isArray(block.props.features) ? block.props.features.map(String) : [];
      const highlighted = Boolean(block.props.highlighted);
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <article
            className={`rounded-xl border p-5 shadow-[var(--shadow-panel)] ${
              highlighted
                ? "border-[var(--gold)] bg-[var(--gold-muted)]/40 ring-1 ring-[var(--gold)]/30"
                : "border-slate-200/80 bg-white"
            }`}
          >
            <h2 className="text-lg font-semibold text-[var(--navy)]">{asString(block.props.planName) || "Plan"}</h2>
            <p className="mt-1 text-sm font-medium text-[var(--gold)]">{asString(block.props.priceLabel) || "Price"}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-700">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--navy)]" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>
            {asString(block.props.ctaLabel) ? (
              <Link
                href={asString(block.props.ctaHref) || "#"}
                className={`mt-4 inline-flex rounded-lg px-4 py-2 text-sm font-semibold ${
                  highlighted ? "cap-btn-primary" : "cap-btn-secondary"
                }`}
              >
                {asString(block.props.ctaLabel)}
              </Link>
            ) : null}
          </article>
        </BlockShell>
      );
    }
    case "compliance_notice": {
      const style = asString(block.props.style);
      const tone = isComplianceNoticeStyle(style)
        ? style
        : "info";
      const styles =
        tone === "legal"
          ? "border-slate-300 bg-slate-50 text-slate-800"
          : tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-sky-200 bg-sky-50 text-sky-950";
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <aside className={`rounded-xl border px-4 py-3 ${styles}`}>
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              <div>
                <h2 className="text-sm font-semibold">{asString(block.props.title) || "Compliance notice"}</h2>
                <p className="mt-1 text-xs leading-5">{asString(block.props.body)}</p>
                {Boolean(block.props.required) ? (
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide opacity-80">Required disclosure</p>
                ) : null}
              </div>
            </div>
          </aside>
        </BlockShell>
      );
    }
    case "team":
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <article className="flex gap-4 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[var(--shadow-panel)]">
            {asString(block.props.imageUrl) ? (
              <Image
                src={asString(block.props.imageUrl)}
                alt={asString(block.props.imageAlt) || asString(block.props.name) || "Team member"}
                width={72}
                height={72}
                className="h-[72px] w-[72px] shrink-0 rounded-xl border border-slate-200 object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-[var(--navy)]">{asString(block.props.name) || "Name"}</h2>
              <p className="text-xs font-medium text-[var(--gold)]">{asString(block.props.title) || "Title"}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{asString(block.props.bio)}</p>
              {asString(block.props.linkedInUrl) ? (
                <Link
                  href={asString(block.props.linkedInUrl)}
                  className="mt-2 inline-block text-xs font-semibold text-[var(--navy)] underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  LinkedIn
                </Link>
              ) : null}
            </div>
          </article>
        </BlockShell>
      );
    case "logo_cloud": {
      const logos = Array.isArray(block.props.logos)
        ? (block.props.logos as Array<{ imageUrl?: string; alt?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            <h2 className="text-sm font-semibold text-[var(--navy)]">{asString(block.props.title) || "Partners"}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {logos.map((logo) => (
                <div key={logo.alt} className="flex h-12 items-center rounded-lg border border-slate-100 bg-[var(--surface-sunken)] px-3">
                  {logo.imageUrl ? (
                    <Image
                      src={logo.imageUrl}
                      alt={logo.alt || "Logo"}
                      width={120}
                      height={32}
                      className="h-8 w-auto max-w-[120px] object-contain"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </BlockShell>
      );
    }
    case "stats_comparison": {
      const items = Array.isArray(block.props.items)
        ? (block.props.items as Array<{ category?: string; label?: string; value?: string; description?: string }>)
        : [];
      return (
        <BlockShell block={block} previewMode={previewMode}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            <h2 className="text-lg font-semibold text-[var(--navy)]">{asString(block.props.title) || "Comparison"}</h2>
            <div className={`mt-4 grid gap-3 ${previewMode === "mobile" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
              {items.map((item) => (
                <div key={`${item.category}-${item.label}`} className="rounded-lg border border-slate-100 bg-[var(--surface-sunken)] p-3">
                  {asString(item.category) ? (
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--gold)]">{item.category}</p>
                  ) : null}
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--navy)]">{item.value}</p>
                  {asString(item.description) ? (
                    <p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </BlockShell>
      );
    }
    case "metric":
      return (
        <BlockShell block={block} previewMode={previewMode} nested={nested}>
          <div className="rounded-lg border border-slate-200/80 bg-white p-3 shadow-[var(--shadow-panel)]">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{asString(block.props.label) || "Metric"}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--navy)]">{asString(block.props.value) || "—"}</p>
            {asString(block.props.description) ? (
              <p className="mt-1 text-xs leading-5 text-slate-600">{asString(block.props.description)}</p>
            ) : null}
          </div>
        </BlockShell>
      );
    case "columns_2":
    case "columns_3":
    case "sidebar_layout":
    case "metric_grid":
      return (
        <BlockShell block={block} previewMode={previewMode} nested={nested}>
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[var(--shadow-panel)]">
            {asString(block.props.title) ? (
              <h2 className="mb-4 text-lg font-semibold text-[var(--navy)]">{asString(block.props.title)}</h2>
            ) : null}
            <LayoutRegionsPreview block={block} previewMode={previewMode} />
          </div>
        </BlockShell>
      );
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
