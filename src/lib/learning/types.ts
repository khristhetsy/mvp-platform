export type LearningProgressStatus = "not_started" | "in_progress" | "completed";

export type LearningReadinessStage = "foundation" | "readiness" | "capital" | "engagement" | "institutional";

export type StageAccessMap = Record<LearningReadinessStage, boolean>;

export type LearningBadgeCriteriaType =
  | "modules_completed"
  | "lessons_completed"
  | "quiz_passed"
  | "streak_days";

export type LearningBadgeRecord = {
  id: string;
  name: string;
  description: string;
  icon_name: string;
  criteria_type: LearningBadgeCriteriaType;
  criteria_value: number;
  created_at: string;
};

export type LearningUserBadgeRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  badge_id: string;
  earned_at: string;
};

export type LearningReminderType = "inactivity_nudge" | "milestone_celebration" | "weekly_digest";

export type LearningReminderRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  type: LearningReminderType;
  scheduled_at: string;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type LearningLeaderboardEntry = {
  rank: number;
  companyId: string;
  companyName: string;
  founderFirstName: string | null;
  industry: string | null;
  overallPercent: number;
  modulesCompleted: number;
  badgesEarned: number;
  isCurrentCompany: boolean;
};

export type LearningAtRiskFounder = {
  companyId: string;
  companyName: string;
  founderId: string;
  founderName: string | null;
  founderEmail: string | null;
  daysInactive: number;
  lastActivityAt: string | null;
  percentComplete: number;
  modulesEngaged: number;
  modulesCompleted: number;
};

export type LearningModuleRecord = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  estimated_time_minutes: number;
  difficulty: string;
  related_remediation_category: string | null;
  required_plan: string;
  readiness_stage: LearningReadinessStage;
  order_index: number;
  is_published: boolean;
  score_points: number;
  created_at: string;
};

export type LearningProgressRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  module_id: string;
  status: LearningProgressStatus;
  percent_complete: number;
  started_at: string | null;
  completed_at: string | null;
  last_viewed_at: string | null;
};

export type FounderLearningModuleView = LearningModuleRecord & {
  progress: LearningProgressRecord | null;
};

export type LearningQuizChoice = {
  id: string;
  label: string;
};

export type LearningQuizQuestion = {
  id: string;
  prompt: string;
  choices: LearningQuizChoice[];
  correctChoiceId: string;
};

export type LearningFounderAction = {
  label: string;
  description: string;
  href?: string;
};

export type LearningReadinessImpact = {
  categories: string[];
  points: number;
  description: string;
};

export type LearningLesson = {
  id: string;
  title: string;
  summary: string;
  keyPoints: string[];
  worksheetPrompt?: string;
  estimatedMinutes?: number;
  learningObjective?: string;
  takeaways?: string[];
  founderAction?: LearningFounderAction;
  relatedChecklist?: string;
  readinessImpact?: LearningReadinessImpact;
  resourcePlaceholder?: string;
  quiz?: {
    passingScore: number;
    questions: LearningQuizQuestion[];
  };
};

export type FounderLessonProgressRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  module_slug: string;
  lesson_id: string;
  status: LearningProgressStatus;
  quiz_score: number | null;
  quiz_passed: boolean | null;
  completed_at: string | null;
  last_viewed_at: string | null;
};

export type FounderQuizAttemptRecord = {
  id: string;
  founder_id: string;
  company_id: string;
  module_slug: string;
  lesson_id: string;
  score: number;
  passed: boolean;
  answers: Record<string, string>;
  created_at: string;
};

export type LessonRecommendation = {
  programSlug: string;
  moduleSlug: string;
  lessonId: string;
  lessonTitle: string;
  reason: string;
  priority: "high" | "medium" | "low";
  href: string;
};

export type LearningModuleContent = {
  slug: string;
  objectives: string[];
  lessons: LearningLesson[];
};

export type LearningRecommendation = {
  moduleId: string;
  slug: string;
  title: string;
  reason: string;
  priority: "high" | "medium" | "low";
  relatedRemediationCategory: string | null;
};

export type AICoachRecommendation = {
  moduleId: string;
  slug: string;
  title: string;
  reason: string;
};

export type ReadinessMilestoneKey =
  | "foundation_ready"
  | "investor_ready_l1"
  | "investor_ready_l2"
  | "institutional_ready"
  | "diligence_verified"
  | "series_a_ready";

export type ReadinessMilestone = {
  key: ReadinessMilestoneKey;
  label: string;
  description: string;
  achieved: boolean;
  achievedAt: string | null;
  criteriaMet: string[];
  criteriaPending: string[];
};
