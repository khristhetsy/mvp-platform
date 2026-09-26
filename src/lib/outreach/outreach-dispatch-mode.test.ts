import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/email/send-email", () => ({ sendEmail: vi.fn() }));

import { outreachDispatchMode } from "@/lib/outreach/investor-outreach";

describe("automated outreach: demo accounts never email investors", () => {
  it("sends only when automation is live and the account may send email", () => {
    expect(outreachDispatchMode(true, true)).toBe("send");
  });
  it("only logs for demo or internal accounts, even when live", () => {
    expect(outreachDispatchMode(true, false)).toBe("log");
  });
  it("only logs while automation is off", () => {
    expect(outreachDispatchMode(false, true)).toBe("log");
    expect(outreachDispatchMode(false, false)).toBe("log");
  });
});
