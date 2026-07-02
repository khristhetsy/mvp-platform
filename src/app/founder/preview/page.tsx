import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/supabase/auth";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ACCENT = "#534AB7";

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
};

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

export default async function FounderPreviewPage() {
  const profile = await requireRole(["founder"]);
  const t = await getTranslations("appPages");
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) notFound();

  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("companies")
    .select(PUBLIC_FIELDS.join(", "))
    .eq("id", company.id)
    .maybeSingle();

  const pub = data as PublicCompany | null;
  if (!pub) notFound();

  const geography = [pub.state, pub.country].filter(Boolean).join(", ") || null;
  const stageLabel = pub.revenue_stage
    ? (STAGE_LABELS[pub.revenue_stage] ?? pub.revenue_stage)
    : null;

  const isPublished = pub.is_published;
  const hasSlug = Boolean(pub.slug);

  return (
    <div style={{ minHeight: "100vh", background: "#F8F9FC", fontFamily: "system-ui, sans-serif" }}>
      {/* Preview banner */}
      <div style={{
        background: "#1e1b4b",
        padding: "10px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 10,
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            background: "#f59e0b", color: "#1e1b4b",
            fontSize: 10, fontWeight: 800, borderRadius: 4,
            padding: "2px 7px", letterSpacing: ".05em", textTransform: "uppercase",
          }}>
            Preview
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", margin: 0 }}>
            This is exactly what investors see on your one-pager.
            {!isPublished && (
              <span style={{ color: "#fbbf24", marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                  <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Not published — investors cannot see this yet.
              </span>
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {hasSlug && isPublished && (
            <a
              href={`/f/${pub.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 12, fontWeight: 600, color: "#1e1b4b",
                background: "white", borderRadius: 8, padding: "6px 14px",
                textDecoration: "none",
              }}
            >
              Open live link ↗
            </a>
          )}
          <Link
            href="/founder/settings"
            style={{
              fontSize: 12, fontWeight: 600, color: "white",
              background: ACCENT, borderRadius: 8, padding: "6px 14px",
              textDecoration: "none",
            }}
          >
            Edit profile
          </Link>
          <Link
            href="/founder"
            style={{
              fontSize: 12, color: "rgba(255,255,255,0.6)",
              textDecoration: "none",
            }}
          >
            ← Back to dashboard
          </Link>
        </div>
      </div>

      {/* Simulated investor nav bar */}
      <div style={{
        background: "white",
        borderBottom: "1px solid #e5e7eb",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: ACCENT, letterSpacing: "-0.02em" }}>
          iCapOS
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600, color: "white",
          background: "#9ca3af", borderRadius: 8,
          padding: "7px 16px",
          cursor: "not-allowed", opacity: 0.7,
        }}>
          Sign in to connect
        </span>
      </div>

      {/* Content — mirrors /f/[slug] exactly */}
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Not-published notice */}
        {!isPublished && (
          <div style={{
            background: "#fffbeb",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "14px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#92400e", margin: "0 0 2px" }}>
                Your profile is not published
              </p>
              <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
                Investors cannot see this page yet.{" "}
                <Link href="/founder/settings" style={{ color: "#92400e", fontWeight: 600 }}>
                  Go to Settings
                </Link>{" "}
                to publish your profile.
              </p>
            </div>
          </div>
        )}

        {/* Header card */}
        <div style={{
          background: "white",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: "32px 36px",
          marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            {pub.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pub.logo_url}
                alt={pub.company_name}
                style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 60, height: 60, borderRadius: 12,
                background: "#EEEDFE", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22, fontWeight: 700, color: ACCENT, flexShrink: 0,
              }}>
                {pub.company_name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "0 0 8px", lineHeight: 1.2 }}>
                {pub.company_name}
              </h1>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
                {pub.industry && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, background: "#EEEDFE", borderRadius: 20, padding: "3px 10px" }}>
                    {pub.industry}
                  </span>
                )}
                {stageLabel && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#065f46", background: "#ecfdf5", borderRadius: 20, padding: "3px 10px" }}>
                    {stageLabel}
                  </span>
                )}
                {geography && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", background: "#f3f4f6", borderRadius: 20, padding: "3px 10px" }}>
                    {geography}
                  </span>
                )}
              </div>
            </div>
          </div>
          {pub.business_description && (
            <p style={{ fontSize: 15, color: "#374151", lineHeight: 1.65, margin: "24px 0 0", borderTop: "1px solid #f3f4f6", paddingTop: 20 }}>
              {pub.business_description}
            </p>
          )}
        </div>

        {/* Key metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
          <MetricCard label={t("funding_ask")} value={formatFunding(pub.funding_amount)} accent />
          <MetricCard label={t("revenue_stage")} value={stageLabel ?? "—"} />
          {geography && <MetricCard label={t("location")} value={geography} />}
          {pub.website && (
            <MetricCard
              label={t("website")}
              value={pub.website.replace(/^https?:\/\/(www\.)?/, "")}
              href={pub.website}
            />
          )}
        </div>

        {pub.use_of_funds && (
          <Section title={t("use_of_funds")} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="2"/><path d="M12 6v2m0 8v2M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" stroke="#374151" strokeWidth="2" strokeLinecap="round"/></svg>}>
            <FormattedText text={pub.use_of_funds} />
          </Section>
        )}

        {pub.founder_goals && (
          <Section title={t("what_we_re_looking_for")} icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="#374151" strokeWidth="2"/><circle cx="12" cy="12" r="6" stroke="#374151" strokeWidth="2"/><circle cx="12" cy="12" r="2" stroke="#374151" strokeWidth="2"/></svg>}>
            <FormattedText text={pub.founder_goals} />
          </Section>
        )}

        {/* CTA — disabled in preview */}
        <div style={{
          background: `linear-gradient(135deg, ${ACCENT} 0%, #7c73e6 100%)`,
          borderRadius: 16, padding: "32px 36px", textAlign: "center", marginTop: 8,
          opacity: 0.7,
          position: "relative",
        }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.05)",
          }}>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase" }}>
              CTA visible to investors
            </span>
          </div>
          <p style={{ fontSize: 18, fontWeight: 700, color: "white", margin: "0 0 8px" }}>
            Interested in {pub.company_name}?
          </p>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.80)", margin: "0 0 24px" }}>
            Join iCapOS to review documents, submit an intro request, or connect with the founding team.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <span style={{ display: "inline-block", background: "white", color: ACCENT, padding: "11px 28px", borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
              Sign in as investor
            </span>
            <span style={{ display: "inline-block", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.35)", padding: "11px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14 }}>
              Learn more
            </span>
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 28, lineHeight: 1.6 }}>
          This one-pager was generated by iCapOS and shared by the founding team. It does not constitute a solicitation or offer to invest.
        </p>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricCard({ label, value, accent, href }: { label: string; value: string; accent?: boolean; href?: string }) {
  return (
    <div style={{ background: accent ? "#EEEDFE" : "white", border: `1px solid ${accent ? "#c4b5fd" : "#e5e7eb"}`, borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: accent ? ACCENT : "#6b7280", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</p>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 15, fontWeight: 700, color: ACCENT, textDecoration: "none" }}>{value}</a>
      ) : (
        <p style={{ fontSize: 16, fontWeight: 700, color: accent ? "#3C3489" : "#111827", margin: 0 }}>{value}</p>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "22px 28px", marginBottom: 16 }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 14px", display: "flex", alignItems: "center", gap: 7 }}>
        {icon} {title}
      </h2>
      {children}
    </div>
  );
}

function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line.trim());
        const content = isBullet ? line.trim().replace(/^[-•*]\s/, "") : line;
        return (
          <p key={i} style={{ fontSize: 14, color: "#374151", margin: 0, lineHeight: 1.6, paddingLeft: isBullet ? 16 : 0, position: "relative" }}>
            {isBullet && (
              <span style={{ position: "absolute", left: 0, top: "0.45em", width: 5, height: 5, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
            )}
            {content}
          </p>
        );
      })}
    </div>
  );
}
