// Multi-reviewer approval: per-reviewer scores + recommendations on an
// application, plus a panel summary. Staff-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { RUBRIC_DIMENSIONS } from "./types";

function raw(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

type Row = Record<string, unknown>;

export type ReviewRecommendation = "approve" | "decline" | "abstain";

export interface ApplicationReview {
  id: string;
  applicationId: string;
  reviewerId: string;
  reviewerName: string | null;
  rubricScores: Record<string, number>;
  recommendation: ReviewRecommendation;
  note: string | null;
  total: number;
}

export interface ReviewSummary {
  count: number;
  approve: number;
  decline: number;
  abstain: number;
  averageTotal: number;
}

function mapReview(r: Row): ApplicationReview {
  const profile = r.profiles as { full_name?: string | null; email?: string | null } | null;
  const scores = (r.rubric_scores as Record<string, number>) ?? {};
  const total = RUBRIC_DIMENSIONS.reduce((s, d) => s + (scores[d] ?? 0), 0);
  return {
    id: String(r.id),
    applicationId: String(r.application_id),
    reviewerId: String(r.reviewer_id),
    reviewerName: profile?.full_name ?? profile?.email ?? null,
    rubricScores: scores,
    recommendation: r.recommendation as ReviewRecommendation,
    note: (r.note as string | null) ?? null,
    total,
  };
}

export async function upsertReview(
  supabase: SupabaseClient<Database>,
  applicationId: string,
  reviewerId: string,
  input: { rubricScores: Record<string, number>; recommendation: ReviewRecommendation; note?: string | null },
): Promise<ApplicationReview> {
  const { data, error } = await raw(supabase)
    .from("speaker_application_reviews")
    .upsert(
      {
        application_id: applicationId,
        reviewer_id: reviewerId,
        rubric_scores: input.rubricScores,
        recommendation: input.recommendation,
        note: input.note ?? null,
      },
      { onConflict: "application_id,reviewer_id" },
    )
    .select("*, profiles:reviewer_id(full_name,email)")
    .single();
  if (error) throw new Error(error.message);
  return mapReview(data as Row);
}

export async function listReviews(
  supabase: SupabaseClient<Database>,
  applicationId: string,
): Promise<ApplicationReview[]> {
  const { data, error } = await raw(supabase)
    .from("speaker_application_reviews")
    .select("*, profiles:reviewer_id(full_name,email)")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReview);
}

export function summarize(reviews: ApplicationReview[]): ReviewSummary {
  const count = reviews.length;
  const approve = reviews.filter((r) => r.recommendation === "approve").length;
  const decline = reviews.filter((r) => r.recommendation === "decline").length;
  const abstain = reviews.filter((r) => r.recommendation === "abstain").length;
  const scored = reviews.filter((r) => r.recommendation !== "abstain");
  const averageTotal = scored.length > 0 ? scored.reduce((s, r) => s + r.total, 0) / scored.length : 0;
  return { count, approve, decline, abstain, averageTotal };
}
