import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubscriptionPackagePicker, type PickerTemplate } from "./SubscriptionPackagePicker";
import { SUBSCRIPTION_SEEDS } from "@/lib/contracts/subscription/seeds";
import type { SubscriberProfile } from "@/lib/contracts/subscription/package";

const names = Object.fromEntries(SUBSCRIPTION_SEEDS.map((s) => [s.key, s.name]));
const installed: PickerTemplate[] = SUBSCRIPTION_SEEDS.map((s) => ({ id: `id-${s.key}`, key: s.key, name: s.name, version: 1, usage: 0, versions: 1 }));

function html(profile: SubscriberProfile, templates: PickerTemplate[] = installed, isAdmin = true, missingMasters = 0) {
  return renderToStaticMarkup(
    createElement(SubscriptionPackagePicker, { templates, isAdmin, profile, onProfile: () => undefined, busy: false, missingMasters, onInstall: () => undefined, onReplace: () => undefined, onHistory: () => undefined, onOpen: () => undefined, openLabel: "Open editor" }),
  );
}

describe("Step 1 for the subscription package", () => {
  it("lists the six parts in order", () => {
    const h = html({ type: "entity", usPerson: true, spouseSigns: false });
    const at = ["Cover and Index", "Subscription Instructions", "Signature Pages", "Forms", "Private Placement Memorandum", "Subscription Agreement"].map((p) => h.indexOf(`>${p}<`));
    expect(at.every((i) => i > -1)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("shows the entity pages and the W-9 for a U.S. entity, not the individual ones", () => {
    const h = html({ type: "entity", usPerson: true, spouseSigns: false });
    expect(h).toContain(names.sub_sig_subscription_entity);
    expect(h).toContain("IRS Form W-9");
    expect(h).not.toContain(names.sub_sig_subscription_individual);
    expect(h).not.toContain(`<span>${names.sub_sig_spouse}</span>`); // a document row, not the profile control
  });

  it("adds the spouse page and the individual letter for an individual with a spouse in a community property state", () => {
    const h = html({ type: "individual", usPerson: true, spouseSigns: true });
    expect(h).toContain(`<span>${names.sub_sig_spouse}</span>`);
    expect(h).toContain(names.sub_form_ai_individual);
  });

  it("lists all three IRS forms and marks the W-8BEN as applying to a non-U.S. individual", () => {
    const h = html({ type: "individual", usPerson: false, spouseSigns: false });
    for (const f of ["IRS Form W-9", "IRS Form W-8BEN-E", "IRS Form W-8BEN"]) expect(h).toContain(f);
    expect(h).toContain("applies to this subscriber");
  });

  it("warns, and offers Install to an admin, when masters are missing; no Replace file for a master that is not there", () => {
    const h = html({ type: "entity", usPerson: true, spouseSigns: false }, installed.slice(0, 3), true, 8);
    expect(h).toContain("not installed");
    expect(h).toContain("Install");
    expect(h).toContain("8 new masters are");
  });

  it("only an admin sees Replace file", () => {
    expect(html({ type: "entity", usPerson: true, spouseSigns: false }, installed, true)).toContain("Replace file");
    expect(html({ type: "entity", usPerson: true, spouseSigns: false }, installed, false)).not.toContain("Replace file");
  });
});
