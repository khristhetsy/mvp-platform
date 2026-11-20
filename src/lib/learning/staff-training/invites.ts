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

export function inviteEmail(input: { audience: TrainingAudience; link: string; inviterName: string; days?: number }) {
  const days = input.days ?? INVITE_TTL_DAYS;
  const subject = input.audience === "licensee" ? "You are invited to your platform training" : "You are invited to iCapOS Staff Training";
  const body = [
    "Hello,",
    "",
    `${input.inviterName} has invited you to the ${input.audience === "licensee" ? "platform training" : "iCapOS Staff Training"} course.`,
    "",
    `Open your invitation: ${input.link}`,
    "",
    `The link works once and expires in ${days} days. Sign in with the account this email was sent to.`,
  ].join("\n");
  return { subject, body };
}
