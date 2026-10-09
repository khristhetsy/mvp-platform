import type { AdminWelcomeLetterStatus } from "@/lib/admin/company-workspace-types";
import { formatPlatformDateTime } from "@/lib/time/platform-tz";

export type WelcomeChip = { label: string; tone: "success" | "info" | "neutral" | "danger" | "warning" };

function when(at: string): string {
  return formatPlatformDateTime(at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/**
 * The company header chip for the founder's welcome letter: its furthest
 * tracked state and when. Null when no letter has been sent (nothing to show).
 */
export function welcomeLetterChip(w: AdminWelcomeLetterStatus | null): WelcomeChip | null {
  if (!w) return null;
  if (w.status === "failed") return { label: `Welcome letter: failed ${when(w.sentAt)}`, tone: "danger" };
  if (w.status !== "sent") return { label: "Welcome letter: not sent", tone: "warning" };
  if (w.bouncedAt) return { label: `Welcome letter: bounced ${when(w.bouncedAt)}`, tone: "danger" };
  if (w.clickedAt) return { label: `Welcome letter: clicked ${when(w.clickedAt)}`, tone: "success" };
  if (w.openedAt) return { label: `Welcome letter: opened ${when(w.openedAt)}`, tone: "success" };
  if (w.deliveredAt) return { label: `Welcome letter: delivered ${when(w.deliveredAt)}`, tone: "info" };
  return { label: `Welcome letter: sent ${when(w.sentAt)}`, tone: "neutral" };
}
