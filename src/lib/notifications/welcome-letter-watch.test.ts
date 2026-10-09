import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/support/inbound", () => ({ supportInboundEnabled: () => false, supportInboxAddress: () => "" }));

import { unopenedLetters } from "./welcome-letter-watch";
import { mapNotificationTypeToEvent } from "./preferences";

const NOW = new Date("2026-10-11T02:00:00Z");
const row = (over: Partial<Parameters<typeof unopenedLetters>[0][number]>) => ({
  id: 1,
  to_email: "a@x.com",
  recipient_user_id: "u1",
  created_at: "2026-10-09T01:06:00Z",
  opened_at: null,
  clicked_at: null,
  bounced_at: null,
  ...over,
});

describe("unopened welcome letters", () => {
  it("flags a letter unopened after 2 days", () => {
    expect(unopenedLetters([row({})], NOW)).toHaveLength(1);
  });

  it("waits until 2 days have passed", () => {
    expect(unopenedLetters([row({ created_at: "2026-10-10T01:06:00Z" })], NOW)).toHaveLength(0);
  });

  it("skips opened, clicked and bounced letters", () => {
    expect(unopenedLetters([row({ opened_at: "2026-10-09T02:00:00Z" })], NOW)).toHaveLength(0);
    expect(unopenedLetters([row({ clicked_at: "2026-10-09T02:00:00Z" })], NOW)).toHaveLength(0);
    expect(unopenedLetters([row({ bounced_at: "2026-10-09T02:00:00Z" })], NOW)).toHaveLength(0);
  });

  it("only judges each founder's latest letter (a fresh resend resets the clock)", () => {
    const old = row({ id: 1 });
    const resent = row({ id: 2, created_at: "2026-10-10T20:00:00Z" });
    expect(unopenedLetters([old, resent], NOW)).toHaveLength(0);
  });

  it("is controlled by the New founder signup setting", () => {
    expect(mapNotificationTypeToEvent("staff_welcome_letter_bounced")).toBe("new_founder_signup");
    expect(mapNotificationTypeToEvent("staff_welcome_letter_unopened")).toBe("new_founder_signup");
  });
});
