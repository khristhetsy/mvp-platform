import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getLearningModuleBySlug } from "@/lib/learning/progress";

export function applyLearningReadinessBonus(baseScore: number | null, bonus: number | null | undefined) {
  const base = baseScore ?? 0;
  const extra = bonus ?? 0;
  if (extra <= 0) return baseScore;
  return Math.min(100, base + extra);
}

export async function awardModuleScorePoints(input: {
  companyId: string;
  moduleSlug: string;
  wasAlreadyCompleted: boolean;
}) {
  if (input.wasAlreadyCompleted) return;

  const learningModule = await getLearningModuleBySlug(input.moduleSlug);
  const points = learningModule?.score_points ?? 0;
  if (points <= 0) return;

  const admin = createServiceRoleClient();
  const { data: company } = await admin
    .from("companies")
    .select("learning_readiness_bonus")
    .eq("id", input.companyId)
    .maybeSingle();

  const currentBonus = company?.learning_readiness_bonus ?? 0;
  const nextBonus = Math.min(100, currentBonus + points);

  if (nextBonus === currentBonus) return;

  await admin
    .from("companies")
    .update({ learning_readiness_bonus: nextBonus, updated_at: new Date().toISOString() })
    .eq("id", input.companyId);
}
