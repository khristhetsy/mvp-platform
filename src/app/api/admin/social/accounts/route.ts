/**
 * Social Hub connected accounts — staff only.
 *   GET                       → { accounts, invites, staff }
 *   GET ?activity=<id>        → { activity }      GET ?impact=<id> → { queued }
 *   PATCH { id, label?, assignedTo?, isDefault? }        → { ok }
 *   PATCH { id, disconnect: true }                        → { ok, skipped }   (queued posts skipped)
 *   POST  { platform, label, assignedTo, email, isDefault } → { ok, invite }  (emails a one-time connect link)
 *   DELETE ?invite=<id>       → { ok }                     (cancel an open invite)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/supabase/auth";
import { listSocialAccounts } from "@/lib/social/queries";
import { sendEmail } from "@/lib/email/send-email";
import { originFromRequest } from "@/lib/social/request-origin";
import {
  accountActivity, createInvite, deleteInvite, disconnectAccount, listOpenInvites, listStaff, queuedCountForAccount, updateAccount, INVITE_TTL_DAYS,
} from "@/lib/social/account-admin";

export const dynamic = "force-dynamic";

async function staffOnly() {
  return requireRole(["admin", "analyst"]).catch(() => null);
}

export async function GET(req: NextRequest): Promise<Response> {
  const profile = await staffOnly();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  try {
    const impact = sp.get("impact");
    if (impact) return NextResponse.json({ queued: await queuedCountForAccount(impact) });
    const activity = sp.get("activity");
    if (activity) return NextResponse.json({ activity: await accountActivity(activity) });
    const [accounts, invites, staff] = await Promise.all([listSocialAccounts(), listOpenInvites(), listStaff()]);
    return NextResponse.json({ accounts, invites, staff });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load accounts." }, { status: 500 });
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  label: z.string().max(80).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
  disconnect: z.boolean().optional(),
});

export async function PATCH(req: NextRequest): Promise<Response> {
  const profile = await staffOnly();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid account update." }, { status: 400 });
  try {
    if (parsed.data.disconnect) {
      const { skipped } = await disconnectAccount(parsed.data.id);
      return NextResponse.json({ ok: true, skipped });
    }
    await updateAccount(parsed.data.id, { label: parsed.data.label, assignedTo: parsed.data.assignedTo, isDefault: parsed.data.isDefault });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't update the account." }, { status: 500 });
  }
}

const inviteSchema = z.object({
  platform: z.enum(["linkedin", "facebook", "instagram"]).default("linkedin"),
  label: z.string().max(80).nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  email: z.string().email(),
  isDefault: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await staffOnly();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const parsed = inviteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const { platform, email, isDefault } = parsed.data;
  const label = parsed.data.label?.trim() || null;
  try {
    const invite = await createInvite({ platform, label, assignedTo: parsed.data.assignedTo ?? null, email, isDefault, createdBy: profile.id });
    const origin = originFromRequest(req);
    const link = `${origin}/connect/social/${invite.token}`;
    const platformName = platform === "linkedin" ? "LinkedIn" : platform === "instagram" ? "Instagram" : "Facebook";
    const who = profile.full_name ?? profile.email ?? "Your team";
    const sent = await sendEmail({
      to: email,
      subject: `Connect your ${platformName} to iCapOS`,
      html: `<p>${who} asked you to connect your ${platformName} account${label ? ` (<b>${label}</b>)` : ""} to the iCapOS Social Hub so posts can be published from it.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 16px;background:#0A66C2;color:#fff;border-radius:8px;text-decoration:none">Connect ${platformName}</a></p>
${platform === "instagram" ? "<p>Instagram connects through the Facebook Page it's linked to, so Facebook will ask you to sign in and approve.</p>" : ""}<p>You'll sign in to iCapOS, then ${platform === "instagram" ? "Facebook" : platformName} will ask you to approve. Your password stays with ${platformName} — iCapOS only stores the access token it hands back.</p>
<p style="color:#666;font-size:12px">This link works once and expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, ignore this email.</p>`,
      text: `${who} asked you to connect your ${platformName} account to the iCapOS Social Hub.\n\nOpen this link (works once, expires in ${INVITE_TTL_DAYS} days):\n${link}\n\nYou'll sign in to iCapOS, then ${platformName} will ask you to approve.`,
    });
    return NextResponse.json({ ok: true, sent, invite: { id: invite.id, email, expiresAt: invite.expiresAt }, link: sent ? undefined : link });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't send the invite." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const profile = await staffOnly();
  if (!profile) return NextResponse.json({ error: "Staff only." }, { status: 403 });
  const id = req.nextUrl.searchParams.get("invite");
  if (!id) return NextResponse.json({ error: "Missing invite." }, { status: 400 });
  try { await deleteInvite(id); return NextResponse.json({ ok: true }); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't cancel the invite." }, { status: 500 }); }
}
