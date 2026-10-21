import { OUTREACH_PROGRAM, type ProgramDefinition, type ProgramModule } from "@/lib/learning/coach/program";
import { CLOSING_PROGRAM } from "@/lib/learning/coach/program-closing";

/** Every coached program, in the order founders take them. */
export const PROGRAMS: ProgramDefinition[] = [OUTREACH_PROGRAM, CLOSING_PROGRAM];

export function getProgram(courseSlug: string): ProgramDefinition | null {
  return PROGRAMS.find((p) => p.courseSlug === courseSlug) ?? null;
}

export function getModule(program: ProgramDefinition, lessonSlug: string): ProgramModule | null {
  return program.modules.find((m) => m.lessonSlug === lessonSlug) ?? null;
}
