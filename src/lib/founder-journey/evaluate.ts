import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';
import { JOURNEY_STAGES } from './types';
import type { JourneyStage, StageApprovalStatus, StageConditions, FounderJourneyState } from './types';
import { allQualifyDocsUploaded } from './documents';
import { computeReadinessScore } from '@/lib/data/founder-readiness';

export async function evaluateFounderJourney(
  supabase: SupabaseClient<Database>,
  profileId: string,
): Promise<FounderJourneyState> {
  // 1. Query profiles
  type ProfileRow = {
    journey_stage: string;
    stage_approval_status: string | null;
    stage_feedback: string | null;
  };
  let profileData: ProfileRow | null = null;
  {
    const result = await supabase
      .from('profiles')
      .select('journey_stage, stage_approval_status, stage_feedback')
      .eq('id', profileId)
      .maybeSingle();
    const { data } = result as { data: ProfileRow | null };
    profileData = data;
  }

  const rawStage = profileData?.journey_stage ?? 'initialize';
  const stage: JourneyStage = (JOURNEY_STAGES as readonly string[]).includes(rawStage)
    ? (rawStage as JourneyStage)
    : 'initialize';
  const stageIndex = JOURNEY_STAGES.indexOf(stage);

  const rawApproval = profileData?.stage_approval_status ?? null;
  const approvalStatus: StageApprovalStatus =
    rawApproval === 'pending' || rawApproval === 'approved' || rawApproval === 'rejected'
      ? rawApproval
      : null;

  const approvalFeedback = profileData?.stage_feedback ?? null;

  // 2. Query companies for onboarding_progress_percent
  type CompanyRow = { id: string; onboarding_progress_percent: number | null };
  let companyData: CompanyRow | null = null;
  {
    const result = await supabase
      .from('companies')
      .select('id, onboarding_progress_percent')
      .eq('founder_id', profileId)
      .maybeSingle();
    const { data } = result as { data: CompanyRow | null };
    companyData = data;
  }

  const companyId = companyData?.id ?? null;
  const onboardingPercent = companyData?.onboarding_progress_percent ?? 0;
  const onboardingComplete = onboardingPercent >= 100;

  // 3. Query diligence_reports for latest readiness_score
  type DiligenceRow = { readiness_score: number | null };
  let diligenceData: DiligenceRow | null = null;
  if (companyId) {
    const result = await supabase
      .from('diligence_reports')
      .select('readiness_score')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data } = result as { data: DiligenceRow | null };
    diligenceData = data;
  }

  // 4. Query documents for required doc types
  type DocumentRow = { document_type: string | null };
  let documentRows: DocumentRow[] = [];
  {
    const result = await supabase
      .from('documents')
      .select('document_type')
      .eq('uploaded_by', profileId);
    const { data } = result as { data: DocumentRow[] | null };
    documentRows = data ?? [];
  }

  const uploadedTypes = documentRows.map((d) => d.document_type);
  const requiredDocsUploaded = allQualifyDocsUploaded(uploadedTypes);

  // Readiness score: prefer the admin-generated diligence score, but fall back
  // to the same self-service computed score the readiness page shows. The AI
  // report path currently always writes a null score, so without this fallback
  // the Qualify gate can never open. Keeping both in sync avoids the founder
  // seeing one number on /founder/readiness and a blocked gate here.
  const uploadedTypeCodes = uploadedTypes.filter((t): t is string => Boolean(t));
  const computedReadiness = computeReadinessScore(uploadedTypeCodes);
  const readinessScore = diligenceData?.readiness_score ?? computedReadiness;
  const readinessQualified = readinessScore >= 75;

  // 5. Query deal_rooms — check if any exist for the company
  let hasDealRoom = false;
  if (companyId) {
    type DealRoomRow = { id: string };
    const result = await supabase
      .from('deal_rooms')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    const { data } = result as { data: DealRoomRow | null };
    hasDealRoom = data !== null;
  }

  // 6. Query investor_interests — check count for company
  let hasInvestorInterest = false;
  if (companyId) {
    type InterestRow = { id: string };
    const result = await supabase
      .from('investor_interests')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle();
    const { data } = result as { data: InterestRow | null };
    hasInvestorInterest = data !== null;
  }

  const conditions: StageConditions = {
    onboardingComplete,
    readinessScore,
    readinessQualified,
    requiredDocsUploaded,
    hasDealRoom,
    hasInvestorInterest,
  };

  // canRequestApproval: must be in qualify stage, have docs + readiness, and not already pending/approved
  const canRequestApproval =
    stage === 'qualify' &&
    readinessQualified &&
    requiredDocsUploaded &&
    approvalStatus !== 'pending' &&
    approvalStatus !== 'approved';

  const pendingApproval = approvalStatus === 'pending';

  return {
    stage,
    stageIndex,
    approvalStatus,
    approvalFeedback,
    conditions,
    canRequestApproval,
    pendingApproval,
  };
}
