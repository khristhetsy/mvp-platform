import type { LearningQuizQuestion } from "@/lib/learning/types";

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export type CourseLessonType = "lesson" | "quiz";

/**
 * One doable step in a coach format lesson. Optional: lessons without steps render
 * exactly as before. A step points at a real founder menu item, so the coach can say
 * where to click and the Screenshot studio knows which screen to capture.
 */
export type CoachStep = {
  /** Short imperative title, for example "Open Investor matches". */
  title: string;
  /** What to do, in one or two sentences. */
  instruction: string;
  /** Menu path as the founder sees it, for example ["Stage 3 – Marketing", "Investor matches"]. */
  menuPath: string[];
  /** Route of the screen, which must exist in the founder navigation. */
  href: string;
  /** Visible label of the control the founder should use on that screen. */
  control?: string;
  /** A common mistake on this step. */
  commonMistake?: string;
  /** A short example the founder can copy. */
  example?: string;
  /** Minutes this step should take. */
  minutes?: number;
};

export type CourseLesson = {
  slug: string;
  title: string;
  durationMinutes: number;
  type: CourseLessonType;
  content: string;
  keyPoints?: string[];
  /** Coach format steps. Present only on courses that support the AI IR Coach. */
  steps?: CoachStep[];
  quiz?: {
    passingScore: number;
    questions: LearningQuizQuestion[];
  };
};

export type CourseSection = {
  slug: string;
  title: string;
  lessons: CourseLesson[];
};

export type Course = {
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  instructor: string;
  category: string;
  level: CourseLevel;
  thumbnailAccent: string;
  whatYouWillLearn: string[];
  sections: CourseSection[];
};
