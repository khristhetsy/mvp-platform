import { NextResponse } from "next/server";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { runCronOrchestrationPass } from "@/lib/notifications/orchestration/run-cron-pass";

export const maxDuration = 60;

async function handleCron(request: Request) {
  if (!getCronSecret()) {
    return cronMisconfiguredResponse();
  }

  if (!validateCronSecret(request)) {
    return cronUnauthorizedResponse();
  }

  const url = new URL(request.url);
  const forceDigest = url.searchParams.get("forceDigest") === "true";

  try {
    const result = await runCronOrchestrationPass({ triggerSource: "cron", forceDigest });
    return NextResponse.json(result, { status: result.success ? 200 : 207 });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : "Orchestration pass failed.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        remindersGenerated: 0,
        digestsGenerated: 0,
        escalationsDetected: 0,
        overdueWorkflowsDetected: 0,
        orchestrationSkippedDuplicates: 0,
        failuresCount: 1,
        errors: [{ step: "cron_pass", message }],
        runId: null,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
