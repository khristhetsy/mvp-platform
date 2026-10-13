import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate, CRON_SUMMARY_HEADER } from "@/lib/cron/gate";
import { getCronSecret, validateCronSecret, cronUnauthorizedResponse, cronMisconfiguredResponse } from "@/lib/notifications/cron/auth";
import { publishFormDFirms } from "@/lib/formd/publish-to-directory";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Keeps the founder Investor directory (Form D tab) in step with the SEC Form D
// registry, so nobody has to press "Publish to founder directory" in the admin
// Form D Desk. Same rules as the button: firms held for review or with an OFAC
// hit or review are skipped, and a firm already published is skipped. A run is
// always safe to repeat. Pause it under Admin › System › Scheduled jobs.
// CRON_SECRET protected.
async function formdPublishGET(request: Request): Promise<Response> {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  try {
    const r = await publishFormDFirms({});
    const res = NextResponse.json(r);
    res.headers.set(
      CRON_SUMMARY_HEADER,
      `${r.published} published, ${r.alreadyPublished} already there, ${r.blocked} blocked (OFAC), ${r.review} held for review`,
    );
    return res;
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Form D publish failed." }, { status: 500 });
  }
}

export const GET = withCronGate("/api/cron/formd-publish", formdPublishGET);
