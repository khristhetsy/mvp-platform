import type { LearningQuizQuestion } from "@/lib/learning/types";

export type CourseLevel = "Beginner" | "Intermediate" | "Advanced";

export type CourseLessonType = "lesson" | "quiz";

export type CourseLesson = {
  slug: string;
  title: string;
  durationMinutes: number;
  type: CourseLessonType;
  content: string;
  keyPoints?: string[];
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
