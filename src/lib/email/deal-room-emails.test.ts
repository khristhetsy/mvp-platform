import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/i18n/user-locale", () => ({ getUserLocale: vi.fn(), getUserLocaleByEmail: vi.fn() }));

import { emailTranslator } from "@/lib/i18n/email-i18n";
import { buildDealRoomEmail } from "./deal-room-emails";

const en = emailTranslator("en");

function question(investor: string) {
  return buildDealRoomEmail(en, {
    subject: en("dealRoom.question.subject", { room: "Seed Round Room" }),
    eyebrow: en("dealRoom.eyebrowActivity"),
    heading: en("dealRoom.question.heading"),
    bodyKey: "dealRoom.question.body",
    vars: { investor, category: "Financials", room: "Seed Round Room" },
    tip: null,
    cta: en("dealRoom.question.cta"),
    url: "https://icapos.com/founder/deal-room/r1",
    context: "Seed Round Room",
  });
}

describe("deal room emails", () => {
  it("renders on the founder layout with the translated body", () => {
    const m = question("Harbor Lane Ventures");
    expect(m.subject).toBe('New investor question in "Seed Round Room"');
    expect(m.html).toContain("height:3px;background:#1A6CE4");
    expect(m.html).toContain("<strong>Harbor Lane Ventures</strong>");
    expect(m.html).toContain("https://icapos.com/founder/deal-room/r1");
  });

  it("escapes investor-controlled names", () => {
    const m = question(`<img src=x onerror=alert(1)>`);
    expect(m.html).not.toContain("<img src=x");
    expect(m.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("no longer carries the unsourced response-time claim", () => {
    expect(question("A").html).not.toContain("significantly more likely");
  });

  it("uses the Spanish footer for Spanish founders", () => {
    const es = emailTranslator("es");
    const m = buildDealRoomEmail(es, {
      subject: es("dealRoom.viewed.subject", { room: "R" }),
      eyebrow: es("dealRoom.eyebrowActivity"),
      heading: es("dealRoom.viewed.heading"),
      bodyKey: "dealRoom.viewed.body",
      vars: { investor: "A", room: "R" },
      cta: es("dealRoom.viewed.cta"),
      url: "https://icapos.com/x",
    });
    expect(m.html).toContain("no es un broker-dealer");
  });
});
