import { describe, it, expect } from "vitest";
import {
  PARTNER_STEPS, stepDueAt, readConfig, activationBlockers, day1Email, day10Email, day21Email,
  emailForStep, firstName, bodyToHtml, stageCounts, stageStopsSteps, formatFee, formatShare,
} from "./config";

const sender = { from_name: "Khris Thetsy", from_email: "outreach@icapos.com", reply_to: "kthetsy@myicfos.com" };
const ready = readConfig({ offer: { share_pct: 20, white_label_price: "$29 per seat per month", spv_fee: 2500, counsel_signed_off: true } }, sender);

describe("partner outreach steps", () => {
  it("runs Day 1, 4, 10 and 21", () => {
    expect(PARTNER_STEPS.map((s) => s.offsetDays + 1)).toEqual([1, 4, 10, 21]);
    expect(PARTNER_STEPS.map((s) => s.channel)).toEqual(["email", "task", "email", "email"]);
  });
  it("schedules each step from the start date and ends after the last", () => {
    const start = new Date("2026-10-05T09:00:00Z");
    expect(stepDueAt(start, 0)?.toISOString()).toBe("2026-10-05T09:00:00.000Z");
    expect(stepDueAt(start, 2)?.toISOString()).toBe("2026-10-14T09:00:00.000Z");
    expect(stepDueAt(start, 4)).toBeNull();
  });
  it("stops steps for every stage but enrolled", () => {
    expect(stageStopsSteps("enrolled")).toBe(false);
    expect(stageStopsSteps("replied")).toBe(true);
    expect(stageStopsSteps("stopped")).toBe(true);
  });
});

describe("activation", () => {
  it("blocks an empty offer and names each gap", () => {
    const b = activationBlockers(readConfig({}, sender));
    expect(b).toHaveLength(4);
    expect(b.join(" ")).toMatch(/subscription share/);
    expect(b.join(" ")).toMatch(/counsel/);
  });
  it("passes a complete offer", () => {
    expect(activationBlockers(ready)).toEqual([]);
  });
  it("rejects a share above 100% and a bad sender", () => {
    const c = readConfig({ offer: { ...ready.offer, share_pct: 150 }, sender: { from_email: "nope" } }, sender);
    expect(activationBlockers(c)).toEqual(["Set the subscription share (1 to 100%).", "Set a valid sender email."]);
  });
});

describe("emails", () => {
  const r = { name: "Alvin Kersting", firm: "Portfolio OP", track: "advisor" as const };
  it("uses the personal draft when there is one", () => {
    expect(day1Email({ ...r, subject: "Hi", body: "Personal" })).toEqual({ subject: "Hi", body: "Personal" });
  });
  it("falls back to the track's standard Day 1", () => {
    const e = day1Email(r);
    expect(e.body).toMatch(/^Hi Alvin,/);
    expect(e.body).toMatch(/Portfolio OP/);
    expect(e.body).toMatch(/icapos\.com\/fit/);
  });
  it("puts the set rates in the Day 10 rate sheet", () => {
    const e = day10Email(r, ready.offer);
    expect(e.body).toMatch(/\$2,500 flat/);
    expect(e.body).toMatch(/20% of every subscription/);
    expect(e.body).toMatch(/\$29 per seat per month/);
  });
  it("gives professionals the share with the rules caveat and no SPV fee", () => {
    const e = day10Email({ ...r, track: "professional" }, ready.offer);
    expect(e.body).toMatch(/where your professional rules allow/);
    expect(e.body).not.toMatch(/SPV/);
  });
  it("returns no email for the task step", () => {
    expect(emailForStep(1, r, ready.offer)).toBeNull();
    expect(emailForStep(3, r, ready.offer)?.subject).toBe(day21Email(r).subject);
  });
  it("never uses dashes as sentence punctuation", () => {
    for (const track of ["advisor", "professional", "angel_group", "accelerator", "bank"] as const) {
      const all = [day1Email({ ...r, track }), day10Email({ ...r, track }, ready.offer), day21Email({ ...r, track })];
      for (const e of all) expect(`${e.subject}\n${e.body}`).not.toMatch(/ [—–-] |—|–/);
    }
  });
  it("handles inbox style names", () => {
    expect(firstName("info@cherrystoneangelgroup.com")).toBe("there");
    expect(firstName("Ravi Belani")).toBe("Ravi");
  });
  it("escapes HTML and links /fit", () => {
    const html = bodyToHtml("A <b>\n\nsee icapos.com/fit");
    expect(html).toContain("&lt;b&gt;");
    expect(html).toContain('href="https://icapos.com/fit"');
  });
});

describe("formatting and counts", () => {
  it("formats rates", () => {
    expect(formatFee(2500)).toBe("$2,500");
    expect(formatShare(12.5)).toBe("12.5%");
  });
  it("counts stages", () => {
    const c = stageCounts([{ stage: "enrolled" }, { stage: "enrolled" }, { stage: "signed" }]);
    expect(c.enrolled).toBe(2);
    expect(c.signed).toBe(1);
    expect(c.pilot).toBe(0);
  });
});
