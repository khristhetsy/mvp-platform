import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api/errors";
import { requireStaffApi } from "@/lib/api/admin";
import { adminDebug } from "@/lib/debug/admin-debug";
import { saveAdminFeedback } from "@/lib/data/admin-reviews";
import { writeAuditLog } from "@/lib/data/audit";
import { z } from "zod";

const feedbackSchema = z.object({
  feedback: z.string().min(1, "Feedback cannot be empty.").max(5000),
});

export async function POST(
  request: Request,
  { params }: Readonly<{ params: Promise<{ id: string }> }>,
) {
  const { id } = await params;

  adminDebug({
    scope: "api.admin.feedback",
    action: "request_received",
    companyId: id,
    path: `/api/admin/companies/${id}/feedback`,
  });

  const auth = await requireStaffApi(["admin", "analyst"]);

  if ("error" in auth) {
    adminDebug({
      scope: "api.admin.feedback",
      companyId: id,
      error: { message: "Staff auth failed." },
    });
    return auth.error as NextResponse;
  }

  const body = await request.json().catch((exception) => {
    adminDebug({ scope: "api.admin.feedback", companyId: id, exception });
    return null;
  });
  const parsed = feedbackSchema.safeParse(body);

  adminDebug({
    scope: "api.admin.feedback",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    payload: body,
    usingServiceRole: true,
    response: parsed.success ? { feedbackLength: parsed.data.feedback.length } : parsed.error.flatten(),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().formErrors.join(", ") || "Invalid feedback." },
      { status: 400 },
    );
  }

  const { data, error } = await saveAdminFeedback(auth.supabase, {
    companyId: id,
    adminId: auth.profile.id,
    feedback: parsed.data.feedback,
  });

  if (error) {
    const message = apiErrorMessage(error);
    adminDebug({
      scope: "api.admin.feedback",
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
    action: "company.feedback_saved",
    entityType: "company",
    entityId: id,
    metadata: { feedback: parsed.data.feedback },
  });

  adminDebug({
    scope: "api.admin.feedback",
    userId: auth.profile.id,
    userRole: auth.profile.role,
    companyId: id,
    status: 200,
    response: data,
  });

  return NextResponse.json(data);
}
