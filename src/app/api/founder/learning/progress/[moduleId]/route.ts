import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { recordModuleView, updateLearningProgress } from "@/lib/learning/progress";
import type { LearningProgressStatus } from "@/lib/learning/types";
import { createNotification } from "@/lib/notifications/notifications";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";

function parseStatus(value: unknown): LearningProgressStatus | null {
  if (value === "not_started" || value === "in_progress" || value === "completed") {
    return value;
  }

  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const company = await ensureFounderCompanyForUser(auth.profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const { moduleId } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    if (Array.isArray(body.completedLessonIds) && typeof body.moduleSlug === "string") {
      const progress = await recordModuleView({
        founderId: auth.profile.id,
        companyId: company.id,
        moduleId,
        moduleSlug: body.moduleSlug,
        completedLessonIds: body.completedLessonIds.map(String),
      });

      if (progress.status === "completed") {
        void createNotification({
          recipientUserId: auth.profile.id,
          type: "learning_module_completed",
          title: "Learning module completed",
          message: `You completed the ${body.moduleSlug.replaceAll("-", " ")} module.`,
          entityType: "learning_module",
          entityId: moduleId,
        });
      }

      return NextResponse.json({ progress });
    }

    const status = parseStatus(body.status);
    const percentComplete = typeof body.percent_complete === "number" ? body.percent_complete : null;

    if (!status || percentComplete == null) {
      return NextResponse.json({ error: "Invalid progress payload." }, { status: 400 });
    }

    const progress = await updateLearningProgress({
      founderId: auth.profile.id,
      companyId: company.id,
      moduleId,
      status,
      percentComplete,
      moduleSlug: typeof body.moduleSlug === "string" ? body.moduleSlug : undefined,
    });

    return NextResponse.json({ progress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update learning progress.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
