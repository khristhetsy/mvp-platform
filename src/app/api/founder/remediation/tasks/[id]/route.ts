import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { updateRemediationTaskStatus } from "@/lib/remediation/tasks";
import type { RemediationStatus } from "@/lib/remediation/types";

function parseStatus(value: unknown): RemediationStatus | null {
  if (value === "open" || value === "in_progress" || value === "completed" || value === "dismissed") {
    return value;
  }

  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiProfile(["founder"]);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = parseStatus(body.status);

  if (!status) {
    return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
  }

  try {
    const task = await updateRemediationTaskStatus({
      taskId: id,
      founderId: auth.profile.id,
      status,
    });

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update task.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
