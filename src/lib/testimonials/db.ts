import "server-only";
import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { computeCrrChange, type CrrScoreRow } from "@/lib/marketing/crr-merge";
import type { FounderResult } from "@/content/founder-results";
import { rowToFounderResult, type TestimonialRow } from "./map";
import type { TestimonialInput } from "./validate";

export type TestimonialContext = {
  email: string;
  profileId: string | null;
  name: string;
  firstName: string;
  company: { id: string; name: string | null; industry: string | null; stage: string | null } | null;
  crr: { start: number; current: number } | null;
  existing: { id: string; status: TestimonialRow["status"] } | null;
};

const COLS =
  "id, email, name, title, company_name, industry, stage, quote, anonymous, show_score, crr_start, crr_current, consent_at, status, reviewed_at, created_at";

/**
 * Everything the form needs for one founder: their name, the company with the
 * biggest CRR rise (same rule as the email merge), and any earlier submission.
 */
export async function loadTestimonialContext(email: string): Promise<TestimonialContext> {
  const db = serviceRoleClientUntyped();
  const normalized = email.trim().toLowerCase();
  const { data: profile } = await db.from("profiles").select("id, full_name").ilike("email", normalized).limit(1).maybeSingle();
  const profileId = (profile as { id: string } | null)?.id ?? null;
  const fullName = ((profile as { full_name: string | null } | null)?.full_name ?? "").trim();

  let company: TestimonialContext["company"] = null;
  let crr: TestimonialContext["crr"] = null;
  if (profileId) {
    const { data: companies } = await db.from("companies").select("id, company_name, industry, funding_stage").eq("founder_id", profileId);
    const list = (companies ?? []) as { id: string; company_name: string | null; industry: string | null; funding_stage: string | null }[];
    if (list.length) {
      const { data: scores } = await db
        .from("company_readiness_scores")
        .select("company_id, effective_score, created_at")
        .in("company_id", list.map((c) => c.id))
        .order("created_at", { ascending: true });
      const rows = (scores ?? []) as CrrScoreRow[];
      let bestGain = -Infinity;
      for (const c of list) {
        const change = computeCrrChange(rows.filter((r) => r.company_id === c.id));
        if (!change) continue;
        const start = Number(change.starting_crr);
        const current = Number(change.current_crr);
        if (current - start > bestGain) {
          bestGain = current - start;
          crr = { start, current };
          company = { id: c.id, name: c.company_name, industry: c.industry, stage: c.funding_stage };
        }
      }
      if (!company) {
        const c = list[0];
        company = { id: c.id, name: c.company_name, industry: c.industry, stage: c.funding_stage };
      }
    }
  }

  const { data: prior } = await db
    .from("founder_testimonials")
    .select("id, status")
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const name = fullName || normalized.split("@")[0];
  return {
    email: normalized,
    profileId,
    name,
    firstName: name.split(/\s+/)[0],
    company,
    crr,
    existing: (prior as TestimonialContext["existing"]) ?? null,
  };
}

/** Save a submission as pending. A founder's earlier pending entry is replaced, not duplicated. */
export async function saveTestimonial(ctx: TestimonialContext, input: TestimonialInput): Promise<void> {
  const db = serviceRoleClientUntyped();
  const row = {
    email: ctx.email,
    profile_id: ctx.profileId,
    company_id: ctx.company?.id ?? null,
    name: ctx.name,
    title: input.title ?? null,
    company_name: ctx.company?.name ?? null,
    industry: ctx.company?.industry ?? null,
    stage: ctx.company?.stage ?? null,
    quote: input.quote,
    anonymous: input.anonymous,
    show_score: input.showScore && ctx.crr != null,
    crr_start: ctx.crr?.start ?? null,
    crr_current: ctx.crr?.current ?? null,
    consent_at: new Date().toISOString(),
    status: "pending",
    updated_at: new Date().toISOString(),
  };
  if (ctx.existing?.status === "pending") {
    const { error } = await db.from("founder_testimonials").update(row).eq("id", ctx.existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("founder_testimonials").insert(row);
  if (error) throw error;
}

export async function listTestimonials(): Promise<TestimonialRow[]> {
  const db = serviceRoleClientUntyped();
  const { data, error } = await db.from("founder_testimonials").select(COLS).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TestimonialRow[];
}

export async function setTestimonialStatus(id: string, status: TestimonialRow["status"], reviewerId: string): Promise<void> {
  const db = serviceRoleClientUntyped();
  const { error } = await db
    .from("founder_testimonials")
    .update({ status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/** Approved testimonials for the homepage. Never throws: the section just stays hidden. */
export async function loadApprovedFounderResults(): Promise<FounderResult[]> {
  try {
    const db = serviceRoleClientUntyped();
    const { data } = await db.from("founder_testimonials").select(COLS).eq("status", "approved").order("reviewed_at", { ascending: false });
    return ((data ?? []) as TestimonialRow[]).map(rowToFounderResult);
  } catch {
    return [];
  }
}
