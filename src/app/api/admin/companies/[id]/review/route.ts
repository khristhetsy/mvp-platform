import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { applyCompanyReview } from "@/lib/data/admin-reviews";
import { writeAuditLog } from "@/lib/data/audit";
import { notifyCompanyFounder } from "@/lib/notifications/notifications";
import { adminReviewActionSchema } from "@/lib/validation";

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;

  adminDebug({
    scope: "api.admin.review",
    action: "request_received",
    companyId: id,
    path: `/api/admin/companies/${id}/review`,
  });

  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.review",
      companyId: id,
      error: { message: "Staff auth failed." },
    });
    return auth.error as NextResponse;
  }

  const body = await request.json().catch((exception) => {
    adminDebug({ scope: "api.admin.review", companyId: id, exception });
    return null;
  });
  const parsed = adminReviewActionSchema.safeParse(body);

  adminDebug({
    scope: "api.admin.review",
    action: "parsed_body",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    payload: body,
    usingServiceRole: true,
    response: parsed.success ? parsed.data : parsed.error.flatten(),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().formErrors.join(", ") || "Invalid request." }, { status: 400 });
  }

  const { action, feedback } = parsed.data;

  if ((action === "reject" || action === "changes_requested") && !feedback?.trim()) {
    return NextResponse.json(
      { error: "Feedback is required when rejecting or requesting changes." },
      { status: 400 },
    );
  }

  const { data, error } = await applyCompanyReview(auth.supabase, {
    companyId: id,
    adminId: auth.profile.id,
    action,
    feedback: feedback?.trim(),
  });

  if (error) {
    const message = apiErrorMessage(error);
    adminDebug({
      scope: "api.admin.review",
      action,
      userId: auth.profile.id,
      userRole: auth.profile.role,
      companyId: id,
      error,
      status: 400,
      response: { error: message },
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: `company.${action}`,
    entityType: "company",
    entityId: id,
    metadata: { feedback: feedback?.trim() ?? null },
  });

  const reviewNotification =
    action === "approve"
      ? {
          type: "company_approved" as const,
          title: "Company approved",
          message: "Your company submission was approved by CapitalOS admin review.",
        }
      : action === "reject"
        ? {
            type: "company_rejected" as const,
            title: "Company review rejected",
            message: `Your company submission was rejected.${feedback?.trim() ? ` Feedback: ${feedback.trim()}` : ""}`,
          }
        : {
            type: "company_changes_requested" as const,
            title: "Changes requested on company submission",
            message: `Admin requested updates to your company profile.${feedback?.trim() ? ` Feedback: ${feedback.trim()}` : ""}`,
          };

  void notifyCompanyFounder(id, {
    actorUserId: auth.profile.id,
    type: reviewNotification.type,
    title: reviewNotification.title,
    message: reviewNotification.message,
    entityType: "company",
    entityId: id,
  });

  adminDebug({
    scope: "api.admin.review",
    action,
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    slug: data?.company?.slug ?? null,
    status: 200,
    response: data,
  });

  return NextResponse.json(data);
}
