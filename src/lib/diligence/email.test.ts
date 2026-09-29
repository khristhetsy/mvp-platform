import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/user-locale", () => ({ getUserLocaleByEmail: vi.fn(async () => "en") }));

import { emailTranslator } from "@/lib/i18n/email-i18n";
import { buildDiligenceAdminEmail, buildDiligenceEmail } from "./email";

const URL = "https://icapos.com/founder/diligence/e1";

describe("buildDiligenceEmail", () => {
  it("builds the founder email in English", () => {
    const m = buildDiligenceEmail("founderReady", emailTranslator("en"), "Northstar Robotics", URL);
    expect(m.subject).toBe("Diligence ready for your input: Northstar Robotics");
    expect(m.html).toContain("Review and respond");
    expect(m.html).toContain(URL);
    expect(m.text).toContain(`Review and respond: ${URL}`);
    expect(m.html).toContain("not a broker-dealer");
  });

  it("builds the founder email in Spanish", () => {
    const m = buildDiligenceEmail("documentsRequested", emailTranslator("es"), "Northstar Robotics", URL);
    expect(m.subject).toBe("Documentos solicitados: diligencia de Northstar Robotics");
    expect(m.html).toContain("Subir documentos");
    expect(m.html).toContain("no es un broker-dealer");
  });

  it("sends the investor release on the investor layout", () => {
    const m = buildDiligenceEmail("released", emailTranslator("en"), "Northstar Robotics", "https://icapos.com/investor/deals/e1");
    expect(m.subject).toBe("Deal available: Northstar Robotics diligence package");
    expect(m.html).toContain("height:3px;background:#0E7C66");
    expect(m.html).toContain("Nothing in this email is an offer");
  });

  it("escapes the company name", () => {
    const m = buildDiligenceEmail("founderReady", emailTranslator("en"), "A&B <Co>", URL);
    expect(m.html).toContain("A&amp;B &lt;Co&gt;");
    expect(m.html).not.toContain("<Co>");
  });

  it("has no dashes in subjects", () => {
    for (const k of ["founderReady", "documentsRequested", "released"] as const) {
      for (const loc of ["en", "es"] as const) {
        expect(buildDiligenceEmail(k, emailTranslator(loc), "X", URL).subject).not.toMatch(/[—–]/);
      }
    }
  });
});

describe("buildDiligenceAdminEmail", () => {
  it("builds the three staff emails on the admin layout", () => {
    const url = "https://icapos.com/admin/diligence/e1";
    expect(buildDiligenceAdminEmail("newResponse", "Northstar", url).subject).toBe("Founder responded: Northstar diligence");
    expect(buildDiligenceAdminEmail("documentSubmitted", "Northstar", url).subject).toBe("Verify a document: Northstar diligence");
    const signed = buildDiligenceAdminEmail("founderSigned", "Northstar", url);
    expect(signed.subject).toBe("Founder signed: Northstar diligence is sealed");
    expect(signed.html).toContain("height:3px;background:#0A1A40");
    expect(signed.text).toContain(url);
  });
});
