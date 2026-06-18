import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Safe public fields — never expose contact_email / contact_phone
const PUBLIC_FIELDS = [
  "id",
  "company_name",
  "industry",
  "country",
  "state",
  "business_description",
  "website",
  "logo_url",
  "funding_amount",
  "use_of_funds",
  "revenue_stage",
  "founder_goals",
  "is_published",
  "slug",
  "created_at",
] as const;

type PublicCompany = {
  id: string;
  company_name: string;
  industry: string | null;
  country: string | null;
  state: string | null;
  business_description: string | null;
  website: string | null;
  logo_url: string | null;
  funding_amount: number | null;
  use_of_funds: string | null;
  revenue_stage: string | null;
  founder_goals: string | null;
  is_published: boolean;
  slug: string | null;
  created_at: string;
};

async function getPublishedCompanyBySlug(slug: string): Promise<PublicCompany | null> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("companies")
    .select(PUBLIC_FIELDS.join(", "))
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data as PublicCompany | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const company = await getPublishedCompanyBySlug(slug);
  if (!company) return { title: "Company not found" };
  return {
    title: `${company.company_name} — Investor One-Pager | CapitalOS`,
    description: company.business_description?.slice(0, 160) ?? undefined,
    openGraph: {
      title: company.company_name,
      description: company.business_description ?? undefined,
      images: company.logo_url ? [company.logo_url] : [],
    },
  };
}

const STAGE_LABELS: Record<string, string> = {
  pre_revenue: "Pre-Revenue",
  early_revenue: "Early Revenue",
  growing: "Growing",
  scaling: "Scaling",
};

function formatFunding(amount: number | null): string {
  if (!amount) return "TBD";
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

const ACCENT = "#534AB7";

export default async function InvestorOnePagerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const company = await getPublishedCompanyBySlug(slug);
  if (!company) notFound();

  const geography = [company.state, company.country].filter(Boolean).join(", ") || null;
  const stageLabel = company.revenue_stage
    ? (STAGE_LABELS[company.revenue_stage] ?? company.revenue_stage)
    : null;

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", fontFamily: "system-ui, sans-serif" }}>
      {/* Top bar */}
      <div style={{
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "-0.02em" }}>
            CapitalOS
          </span>
        </Link>
        <Link
          href="/login"
          style={{
            fontSize: 12, fontWeight: 600, color: "white",
            background: ACCENT, borderRadius: 8,
            padding: "7px 16px", textDecoration: "none",
          }}
        >
          Sign in to connect
        </Link>
      </div>

      {/* Content */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header card */}
        <div style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: "32px 36px",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            {/* Logo or initials */}
            {company.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.company_name}
                style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: 12,
                background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700, color: ACCENT, flexShrink: 0,
              }}>
                {company.company_name.slice(0, 1).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "0 0 8px", lineHeight: 1.2 }}>
                {company.company_name}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
                {company.industry && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: ACCENT,
                    background: "#EEEDFE", borderRadius: 20, padding: "3px 10px",
                  }}>
                    {company.industry}
                  </span>
                )}
                {stageLabel && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: "#065f46",
                    background: "#ecfdf5", borderRadius: 20, padding: "3px 10px",
                  }}>
                    {stageLabel}
                  </span>
                )}
                {geography && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: "#6b7280",
                    background: "#f3f4f6", borderRadius: 20, padding: "3px 10px",
                  }}>
                    {geography}
                  </span>
                )}
              </div>
            </div>
          </div>

          {company.business_description && (
            <p style={{
              fontSize: 15, color: "#374151", lineHeight: 1.65,
              margin: "24px 0 0",
              borderTop: "1px solid #f3f4f6", paddingTop: 20,
            }}>
              {company.business_description}
            </p>
          )}
        </div>

        {/* Key metrics */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, marginBottom: 20,
        }}>
          <MetricCard
            label="Funding ask"
            value={formatFunding(company.funding_amount)}
            accent
          />
          <MetricCard
            label="Revenue stage"
            value={stageLabel ?? "—"}
          />
          {geography && (
            <MetricCard label="Location" value={geography} />
          )}
          {company.website && (
            <MetricCard
              label="Website"
              value={company.website.replace(/^https?:\/\/(www\.)?/, "")}
              href={company.website}
            />
          )}
        </div>

        {/* Use of funds */}
        {company.use_of_funds && (
          <Section title="Use of funds" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          }>
            <FormattedText text={company.use_of_funds} />
          </Section>
        )}

        {/* Founder goals */}
        {company.founder_goals && (
          <Section title="What we're looking for" icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
              <line x1="12" y1="2" x2="12" y2="5" />
            </svg>
          }>
            <FormattedText text={company.founder_goals} />
          </Section>
        )}

        {/* CTA */}
        <div style={{
          background: `linear-gradient(135deg, ${ACCENT} 0%, #7c73e6 100%)`,
          borderRadius: 16, padding: "32px 36px", textAlign: "center", marginTop: 8,
        }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "white", margin: "0 0 8px" }}>
            Interested in {company.company_name}?
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", margin: "0 0 24px", lineHeight: 1.5 }}>
            Join CapitalOS to review documents, submit an intro request, or connect with the founding team.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                background: "white", color: ACCENT,
                padding: "11px 28px", borderRadius: 10,
                fontWeight: 700, fontSize: 14, textDecoration: "none",
              }}
            >
              Sign in as investor
            </Link>
            <Link
              href="/pricing"
              style={{
                display: "inline-block",
                background: "rgba(255,255,255,0.15)", color: "white",
                border: "1px solid rgba(255,255,255,0.35)",
                padding: "11px 28px", borderRadius: 10,
                fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}
            >
              Learn more
            </Link>
          </div>
        </div>

        {/* Footer note */}
        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 28, lineHeight: 1.6 }}>
          This one-pager was generated by CapitalOS and shared by the founding team. It does not constitute
          a solicitation or offer to invest. Information is provided for indicative purposes only.
        </p>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  accent,
  href,
}: {
  label: string;
  value: string;
  accent?: boolean;
  href?: string;
}) {
  return (
    <div style={{
      background: accent ? "#EEEDFE" : "white",
      border: `1px solid ${accent ? "#c4b5fd" : "#e5e7eb"}`,
      borderRadius: 12,
      padding: "16px 18px",
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: accent ? ACCENT : "#6b7280", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>
        {label}
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 15, fontWeight: 700, color: ACCENT, textDecoration: "none" }}
        >
          {value}
        </a>
      ) : (
        <p style={{ fontSize: 16, fontWeight: 700, color: accent ? "#3C3489" : "#111827", margin: 0 }}>
          {value}
        </p>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{
      background: "white",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "22px 28px",
      marginBottom: 16,
    }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 7 }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  // Split on newlines; render bullet-like lines nicely
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line.trim());
        const content = isBullet ? line.trim().replace(/^[-•*]\s/, "") : line;
        return (
          <p key={i} style={{
            fontSize: 14, color: "#374151", margin: 0,
            lineHeight: 1.6,
            paddingLeft: isBullet ? 16 : 0,
            position: "relative",
          }}>
            {isBullet && (
              <span style={{
                position: "absolute", left: 0, top: "0.45em",
                width: 5, height: 5, borderRadius: "50%",
                background: ACCENT, display: "inline-block",
              }} />
            )}
            {content}
          </p>
        );
      })}
    </div>
  );
}
