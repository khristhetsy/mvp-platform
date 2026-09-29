import { afterEach, describe, expect, it } from "vitest";
import {
  absoluteUrl,
  companyHeadline,
  escapeHtml,
  formatBytes,
  renderAdminActivityEmail,
  renderFounderUploadEmail,
} from "@/lib/activity/email-templates";

const original = process.env.NEXT_PUBLIC_APP_URL;
afterEach(() => {
  process.env.NEXT_PUBLIC_APP_URL = original;
});

describe("absoluteUrl", () => {
  it("falls back to icapos.com when the env var is empty", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    expect(absoluteUrl("/admin/companies/abc?tab=activity")).toBe(
      "https://icapos.com/admin/companies/abc?tab=activity",
    );
  });
  it("uses the env origin without doubling slashes", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.icapos.com/";
    expect(absoluteUrl("/founder")).toBe("https://staging.icapos.com/founder");
  });
});

describe("companyHeadline", () => {
  it("folds a past tense verb into a sentence", () => {
    expect(companyHeadline("Northstar Robotics", "Uploaded pitch deck")).toBe(
      "Northstar Robotics uploaded pitch deck",
    );
  });
  it("never attributes an investor's action to the company", () => {
    expect(companyHeadline("Northstar Robotics", "Investor requested an introduction")).toBe(
      "Northstar Robotics: Investor requested an introduction",
    );
  });
  it("keeps the title when the company is unknown", () => {
    expect(companyHeadline(null, "Uploaded pitch deck")).toBe("Uploaded pitch deck");
  });
});

describe("helpers", () => {
  it("escapes html", () => {
    expect(escapeHtml(`<b>"A&B"</b>`)).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  });
  it("formats sizes", () => {
    expect(formatBytes(4_404_019)).toBe("4.2 MB");
    expect(formatBytes(null)).toBeNull();
  });
});

describe("renderAdminActivityEmail", () => {
  const base = {
    title: "Uploaded pitch deck",
    stageLabel: "Stage 2 · Preparation",
    classDescription: "Deck, financials, business plan, cap table",
    critical: false,
    companyName: "Northstar Robotics",
    actor: { name: "Jane Carter", email: "jane@northstar.ai", roleLabel: "Founder" },
    document: { fileName: "Northstar_Deck_v3.pdf", sizeBytes: 4_404_019 },
    checklist: [
      { label: "Pitch deck", done: true },
      { label: "Financial model", done: false },
      { label: "Cap table", done: false },
    ],
    readinessScore: 62,
    ownerName: null,
    noOwner: true,
    primaryUrl: "https://icapos.com/admin/companies/abc?tab=activity",
    assignUrl: "https://icapos.com/admin/activity/assignments",
  };

  it("names the company, the person and the file", () => {
    const email = renderAdminActivityEmail(base);
    expect(email.subject).toBe("Northstar Robotics uploaded pitch deck · Stage 2 Preparation");
    expect(email.text).toContain("Jane Carter (Founder, jane@northstar.ai) at Northstar Robotics");
    expect(email.text).toContain("File: Northstar_Deck_v3.pdf · 4.2 MB");
    expect(email.text).toContain("Done: Pitch deck · Pending: Financial model, Cap table");
    expect(email.html).toContain("No owner is assigned to this stage yet.");
    expect(email.html).toContain("https://icapos.com/admin/activity/assignments");
    expect(email.text).not.toContain("nobody is assigned");
  });

  it("marks critical alerts and drops the owner button when someone leads", () => {
    const email = renderAdminActivityEmail({ ...base, critical: true, noOwner: false, ownerName: "Johnny Rivera" });
    expect(email.subject.startsWith("[Action needed] ")).toBe(true);
    expect(email.text).toContain("Owner: Johnny Rivera");
    expect(email.html).not.toContain("Assign owner");
  });

  it("escapes user supplied names", () => {
    const email = renderAdminActivityEmail({ ...base, companyName: "<script>x</script>" });
    expect(email.html).not.toContain("<script>x</script>");
  });
});

describe("renderFounderUploadEmail", () => {
  const base = {
    firstName: "Jane",
    companyName: "Northstar Robotics",
    documentLabel: "pitch deck",
    fileName: "Northstar_Deck_v3.pdf",
    replaced: false,
    stepIndex: 1,
    checklist: [
      { label: "Pitch deck", done: true },
      { label: "Financial model", done: false },
      { label: "Cap table", done: false },
    ],
    next: { label: "Financial model", cta: "Build it in-app", url: "https://icapos.com/founder/financial-model" },
    workspaceUrl: "https://icapos.com/founder",
  };

  it("confirms the file and points at the next core document", () => {
    const email = renderFounderUploadEmail(base);
    expect(email.subject).toBe("Jane, we received your pitch deck");
    expect(email.text).toContain("2 core documents remain before investor matching: financial model, cap table.");
    expect(email.text).toContain("Your raise: step 2 of 4 (Ready)");
    expect(email.html).toContain("https://icapos.com/founder/financial-model");
  });

  it("never shows staff only details", () => {
    const email = renderFounderUploadEmail(base);
    expect(email.text).not.toMatch(/owner|readiness rating/i);
  });

  it("says so when the core set is complete", () => {
    const email = renderFounderUploadEmail({
      ...base,
      checklist: base.checklist.map((i) => ({ ...i, done: true })),
      next: null,
    });
    expect(email.text).toContain("Your core documents are complete.");
  });
});
