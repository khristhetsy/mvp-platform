const LESSON_KEY_SEP = "__";

export function encodeLessonKey(moduleSlug: string, lessonId: string) {
  return `${moduleSlug}${LESSON_KEY_SEP}${lessonId}`;
}

export function decodeLessonKey(lessonKey: string): { moduleSlug: string; lessonId: string } | null {
  const idx = lessonKey.indexOf(LESSON_KEY_SEP);
  if (idx <= 0) return null;
  return {
    moduleSlug: lessonKey.slice(0, idx),
    lessonId: lessonKey.slice(idx + LESSON_KEY_SEP.length),
  };
}

export function lessonHref(programSlug: string, moduleSlug: string, lessonId: string) {
  return `/founder/learning/${programSlug}/${encodeLessonKey(moduleSlug, lessonId)}`;
}

export function programHref(programSlug: string) {
  return `/founder/learning/${programSlug}`;
}
