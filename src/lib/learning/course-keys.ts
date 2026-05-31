export function courseHref(courseSlug: string) {
  return `/founder/learning/${courseSlug}`;
}

export function courseLessonHref(courseSlug: string, lessonSlug: string) {
  return `/founder/learning/${courseSlug}/${lessonSlug}`;
}
