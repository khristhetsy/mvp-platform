import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { withCronGate } from "@/lib/cron/gate";
import {
  cronMisconfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  validateCronSecret,
} from "@/lib/notifications/cron/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { writeAuditLog } from "@/lib/data/audit";
import { prepareUserDeletion } from "@/lib/users/ownership-transfer";
import { cancelSubscription } from "@/lib/lemonsqueezy";
import { isCardSubscription } from "@/lib/billing/plan-change";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Daily: permanently remove accounts whose 30 day deletion window has passed.
 * An account that still owns records only it can own (IR projects, notes,
 * reports) is skipped and logged, never force deleted.
 */
async function handle(request: Request) {
  if (!getCronSecret()) return cronMisconfiguredResponse();
  if (!validateCronSecret(request)) return cronUnauthorizedResponse();

  const admin = createServiceRoleClient();
  const { data: due, error } = await admin
    .from("profiles")
    .select("id, email, role")
    .not("deletion_scheduled_for", "is", null)
    .lte("deletion_scheduled_for", new Date().toISOString())
    .eq("is_super_admin", false)
    .limit(25);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  let purged = 0;
  let blocked = 0;
  let failed = 0;
  for (const row of due ?? []) {
    try {
      const block = await prepareUserDeletion(admin, row.id, null);
      if (block) {
        blocked += 1;
        await writeAuditLog(admin, {
          userId: row.id,
          action: "account.purge_blocked",
          entityType: "profile",
          entityId: row.id,
          metadata: { items: block.items },
        });
        continue;
      }
      // Never remove an account that still has a live card subscription: it
      // would keep charging with nobody able to cancel it.
      const { data: subRaw } = await admin
        .from("subscriptions")
        .select("plan_type, ls_subscription_id, ls_variant_id, cancel_at_period_end, subscription_status")
        .eq("profile_id", row.id)
        .maybeSingle();
      const sub = subRaw as {
        plan_type: string;
        ls_subscription_id: string | null;
        ls_variant_id: string | null;
        cancel_at_period_end: boolean | null;
        subscription_status: string;
      } | null;
      if (
        sub?.ls_subscription_id &&
        isCardSubscription(sub) &&
        !sub.cancel_at_period_end &&
        sub.subscription_status === "active"
      ) {
        try {
          await cancelSubscription(sub.ls_subscription_id);
        } catch (cancelErr) {
          blocked += 1;
          await writeAuditLog(admin, {
            userId: row.id,
            action: "account.purge_blocked",
            entityType: "profile",
            entityId: row.id,
            metadata: { reason: "subscription_cancel_failed" },
          });
          Sentry.captureException(cancelErr, { tags: { pass: "purge_deleted_accounts" } });
          continue;
        }
      }
      await writeAuditLog(admin, {
        userId: row.id,
        action: "account.purged",
        entityType: "profile",
        entityId: row.id,
        metadata: { email: row.email, role: row.role },
      });
      const { error: delErr } = await admin.auth.admin.deleteUser(row.id);
      if (delErr) throw new Error(delErr.message);
      purged += 1;
    } catch (err) {
      failed += 1;
      Sentry.captureException(err, { tags: { pass: "purge_deleted_accounts" } });
    }
  }

  return NextResponse.json({ ok: true, due: due?.length ?? 0, purged, blocked, failed });
}

async function scheduledGET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export const GET = withCronGate("/api/cron/purge-deleted-accounts", scheduledGET);
