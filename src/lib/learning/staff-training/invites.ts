import { createHash, randomBytes } from "node:crypto";
import type { TrainingAudience } from "./catalog";

/** Invitations are valid for 7 days by default. */
export const INVITE_TTL_DAYS = 7;

export function generateInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteExpiry(from: Date = new Date(), days = INVITE_TTL_DAYS): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export type InviteRow = {
  status: string;
  expires_at: string;
  email: string;
};

export type InviteCheck = { ok: true } | { ok: false; reason: "revoked" | "used" | "expired" | "wrong_account" };

/** Single use, expiring, and bound to the invited email address. */
export function checkInvite(invite: InviteRow, signedInEmail: string | null | undefined, now: Date = new Date()): InviteCheck {
  if (invite.status === "revoked") return { ok: false, reason: "revoked" };
  if (invite.status === "accepted") return { ok: false, reason: "used" };
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  if (!signedInEmail || signedInEmail.trim().toLowerCase() !== invite.email.trim().toLowerCase()) {
    return { ok: false, reason: "wrong_account" };
  }
  return { ok: true };
}

export const INVITE_DENIED_COPY: Record<Exclude<InviteCheck, { ok: true }>["reason"], string> = {
  revoked: "This invitation was withdrawn. Ask your iCFO contact for a new one.",
  used: "This invitation has already been used. Sign in to open your training.",
  expired: "This invitation has expired. Ask your iCFO contact for a new one.",
  wrong_account: "This invitation was sent to a different email address. Sign in with the account it was sent to.",
};

export function inviteLink(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/learn/training/accept?token=${encodeURIComponent(token)}`;
}

export function inviteEmail(input: { audience: TrainingAudience; signUp: string; training: string; inviterName: string; existingUser: boolean; days?: number }) {
  const days = input.days ?? INVITE_TTL_DAYS;
  const course = input.audience === "licensee" ? "platform training" : "Training";
  const subject = input.existingUser ? `You now have access to ${course}` : `You are invited to ${course}`;
  const lines = input.existingUser
    ? ["Hello,", "", `${input.inviterName} gave you access to the ${course} course.`, "", `Open it here: ${input.training}`]
    : [
        "Hello,",
        "",
        `${input.inviterName} has invited you to the ${course} course.`,
        "",
        `1. Create your free account with this email address: ${input.signUp}`,
        `2. Then open your course: ${input.training}`,
        "",
        `The invitation is open for ${days} days.`,
      ];
  return { subject, body: lines.join("\n") };
}

export type ClaimableInvite = InviteRow & { id: string; created_at?: string };

/** The newest invitation that is still open for this email, or null. Matching is by email, case insensitive. */
export function pickClaimableInvite<T extends ClaimableInvite>(invites: T[], email: string | null | undefined, now: Date = new Date()): T | null {
  if (!email) return null;
  const open = invites
    .filter((i) => checkInvite(i, email, now).ok)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return open[0] ?? null;
}

/** Link in the invitation email. People who have no account sign up as a free founder, then open the course. */
export function signUpLink(appUrl: string, email: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `${base}/auth/sign-up?role=founder&plan=founder_free&email=${encodeURIComponent(email)}`;
}

export function trainingLink(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/learn/training`;
}
