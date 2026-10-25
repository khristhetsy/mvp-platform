import { describe, expect, it } from "vitest";
import { leftoverPlaceholders, packageItems, packageLinkedValues, packageLinkValue, SUBSCRIPTION_TEMPLATE_KEYS, type SubscriberProfile } from "./package";

const keysOf = (p: SubscriberProfile) => packageItems(p).map((i) => (i.source === "template" ? i.templateKey : i.source === "pdf" ? `pdf:${i.formKey}` : `missing:${i.title}`));

describe("which documents a subscriber gets", () => {
  it("U.S. entity: entity pages, W-9, entity verification letter, no spouse page", () => {
    expect(keysOf({ type: "entity", usPerson: true, spouseSigns: false })).toEqual([
      "sub_cover_index",
      "sub_instructions",
      "sub_sig_subscription_entity",
      "sub_sig_llc_entity",
      "pdf:w9",
      "pdf:w8bene",
      "missing:IRS Form W-8BEN",
      "sub_form_ai_entity",
      "sub_ppm",
      "sub_agreement",
    ]);
  });

  const applies = (p: SubscriberProfile) =>
    packageItems(p).flatMap((i) => (i.source === "template" ? [] : i.applies ? [i.source === "pdf" ? i.formKey : "w8ben"] : []));

  it("the Forms part always lists all three IRS forms and marks the one that applies", () => {
    for (const type of ["entity", "individual"] as const)
      expect(keysOf({ type, usPerson: true, spouseSigns: false })).toEqual(expect.arrayContaining(["pdf:w9", "pdf:w8bene", "missing:IRS Form W-8BEN"]));
    expect(applies({ type: "entity", usPerson: true, spouseSigns: false })).toEqual(["w9"]);
    expect(applies({ type: "entity", usPerson: false, spouseSigns: false })).toEqual(["w8bene"]);
    expect(applies({ type: "individual", usPerson: false, spouseSigns: false })).toEqual(["w8ben"]);
  });

  it("individual: individual pages and individual verification letter", () => {
    const k = keysOf({ type: "individual", usPerson: true, spouseSigns: false });
    expect(k).toContain("sub_sig_subscription_individual");
    expect(k).toContain("sub_sig_llc_individual");
    expect(k).toContain("sub_form_ai_individual");
    expect(k).not.toContain("sub_sig_spouse");
  });

  it("joint individuals get the joint signature pages, the individual letter, and never the spouse page", () => {
    const k = keysOf({ type: "joint", usPerson: true, spouseSigns: true });
    expect(k).toContain("sub_sig_subscription_joint");
    expect(k).toContain("sub_sig_llc_joint");
    expect(k).toContain("sub_form_ai_individual");
    expect(k).not.toContain("sub_sig_spouse");
    expect(k).not.toContain("sub_sig_subscription_individual");
  });

  it("the Agreement of Spouse is added for an individual with a spouse in a community property state, after the subscription page", () => {
    const k = keysOf({ type: "individual", usPerson: true, spouseSigns: true });
    expect(k.indexOf("sub_sig_spouse")).toBe(k.indexOf("sub_sig_subscription_individual") + 1);
  });

  it("an entity never gets the spouse page, even if the flag was left on", () => {
    expect(keysOf({ type: "entity", usPerson: true, spouseSigns: true })).not.toContain("sub_sig_spouse");
  });

  it("a non-U.S. individual needs a W-8BEN the source package does not carry, and says so", () => {
    const items = packageItems({ type: "individual", usPerson: false, spouseSigns: false });
    const m = items.find((i) => i.source === "missing");
    expect(m).toBeTruthy();
    expect(m && "title" in m && m.title).toBe("IRS Form W-8BEN");
  });

  it("every template a profile can use is in the key list", () => {
    for (const type of ["entity", "individual"] as const)
      for (const usPerson of [true, false])
        for (const spouseSigns of [true, false])
          for (const i of packageItems({ type, usPerson, spouseSigns })) if (i.source === "template") expect(SUBSCRIPTION_TEMPLATE_KEYS).toContain(i.templateKey);
  });

  it("parts come out in package order", () => {
    const order = ["cover_index", "instructions", "signature_pages", "forms", "ppm", "agreement"];
    const parts = packageItems({ type: "individual", usPerson: true, spouseSigns: true }).map((i) => order.indexOf(i.part));
    expect([...parts].sort((a, b) => a - b)).toEqual(parts);
  });
});

describe("package links", () => {
  it("a value typed in an earlier document is offered to a later one, first holder wins", () => {
    const out = packageLinkedValues(
      ["spv_name", "company_name", "subscriber_name"],
      [
        { tokens: ["spv_name", "company_name", "date"], values: { spv_name: "ICFO ARRAYWORKS SPV, LLC", company_name: "" }, label: "Cover" },
        { tokens: ["subscriber_name", "spv_name"], values: { subscriber_name: "NORTHGATE CAPITAL, LLC", spv_name: "OTHER" }, label: "Signature page" },
      ],
    );
    expect(out).toEqual([
      { token: "spv_name", value: "ICFO ARRAYWORKS SPV, LLC", source: "Cover" },
      { token: "subscriber_name", value: "NORTHGATE CAPITAL, LLC", source: "Signature page" },
    ]);
  });

  it("compares the amount as a plain number and text as trimmed text", () => {
    expect(packageLinkValue("subscription_amount", "$150,000.00")).toBe("150000.00");
    expect(packageLinkValue("spv_name", "  ICFO X SPV, LLC ")).toBe("ICFO X SPV, LLC");
  });
});

describe("blanks left from the BLANK package", () => {
  it("finds the placeholders that must be filled and ignores ordinary parentheses", () => {
    expect(leftoverPlaceholders("Fund (SPV LLC COMPANY) and (ISSUER COMPANY) on (DATE) (DATE); the Fund (the “Fund”) (Rule 506(c)) (IPO)")).toEqual(["(SPV LLC COMPANY)", "(ISSUER COMPANY)", "(DATE)"]);
    expect(leftoverPlaceholders("(ISSUER LOGO) (TIME) (00000) (BANK)")).toEqual(["(ISSUER LOGO)", "(TIME)", "(00000)", "(BANK)"]);
    expect(leftoverPlaceholders("Net Income 000,000.00 and $0,000,000 raised")).toEqual(["000,000.00", "$0,000,000"]);
    expect(leftoverPlaceholders("nothing left")).toEqual([]);
  });
});
