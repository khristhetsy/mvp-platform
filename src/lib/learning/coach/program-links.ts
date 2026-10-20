/** Routes of the coached lesson page. Kept apart so client components can import them without server code. */
export function coachLessonHref(courseSlug: string, lessonSlug: string) {
  return `/founder/learning/coach/${courseSlug}/${lessonSlug}`;
}
