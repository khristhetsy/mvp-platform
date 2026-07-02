// The single shared entry point for creating a marketing notification. Every hub
// module (CMO, compliance gate, AI SEO, campaigns) calls this — it resolves the
// admin's effective prefs, honors quiet hours, and fans out to channels.
// Idempotent per `dedupeKey` (the in-app unique index guarantees no duplicates).

import { marketingDb } from "@/lib/marketing/db";
import { getEffective } from "./resolve";
import { isWithinQuietHours } from "./cadence";
import { deliverInApp, deliverEmail, deliverPush } from "./channels";

export interface EmitOptions {
  adminId: string;
  typeId: string;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
  dedupeKey?: string; // e.g. "compliance.awaiting_review:2026-06-30"
}

export type EmitResult =
  | { delivered: true; inApp: boolean; email: boolean; push: boolean }
  | { skipped: "disabled" | "unknown_type" };

async function adminEmail(adminId: string): Promise<string | undefined> {
  const db = marketingDb();
  const { data } = await db.from("profiles").select("email").eq("id", adminId).maybeSingle();
  return (data as { email?: string } | null)?.email ?? undefined;
}

export async function emitNotification(opts: EmitOptions): Promise<EmitResult> {
  const { eff, settings } = await getEffective(opts.adminId, opts.typeId);
  if (!eff) return { skipped: "unknown_type" };
  if (!eff.enabled) return { skipped: "disabled" };

  const inQuiet = isWithinQuietHours(settings);
  const canSendOut = !inQuiet || eff.urgent; // urgent bypasses quiet hours for email/push

  let inApp = false;
  let email = false;
  let push = false;

  // In-app: quiet hours never suppress the feed record.
  if (eff.channels.includes("in_app")) {
    inApp = await deliverInApp(opts);
  }
  // Email: suppressed during quiet hours unless urgent.
  if (eff.channels.includes("email") && canSendOut) {
    const to = await adminEmail(opts.adminId);
    email = await deliverEmail({ ...opts, toEmail: to });
  }
  // Push: deferred no-op, same quiet-hours rule.
  if (eff.channels.includes("push") && canSendOut) {
    push = await deliverPush(opts);
  }

  return { delivered: true, inApp, email, push };
}
