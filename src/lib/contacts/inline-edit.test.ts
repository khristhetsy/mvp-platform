import { describe, it, expect } from "vitest";
import { sourceKeysFor, tagFor, confirmPatch, odooFieldFor, odooValue, isColumnField } from "./inline-edit";
import type { EditableFieldDesc } from "@/lib/crm-connectors/odoo/schema";

describe("sourceKeysFor / tagFor", () => {
  it("finds the provenance keys of fill and derivation fields", () => {
    expect(sourceKeysFor("website")).toEqual(["_website_source"]);
    expect(sourceKeysFor("country")).toEqual(["_country_source"]);
    expect(sourceKeysFor("Industries")).toContain("_industry_source");
    expect(sourceKeysFor("Investor preferences for the number of deals per year?")).toContain("_deals_source");
    expect(sourceKeysFor("Entrepreneur operating stage?")).toEqual(expect.arrayContaining(["_stage_source", "_operating_stage_source"]));
    expect(sourceKeysFor("Investor profile")).toContain("_type_source");
    expect(sourceKeysFor("Investor short bio")).toEqual([]);
  });
  it("reads the tag that is set", () => {
    expect(tagFor({ _country_source: "derived:phone" }, "country")).toBe("derived:phone");
    expect(tagFor({ _operating_stage_source: "guess:funding_stage" }, "Entrepreneur operating stage?")).toBe("guess:funding_stage");
    expect(tagFor({}, "country")).toBeNull();
  });
});

describe("confirmPatch", () => {
  it("clears the tag and pulls the field out of every fill undo list", () => {
    const ov = {
      country: "Germany", _country_source: "derived:phone",
      _cfill_contact: ["_website_source", "country", "_country_source"],
      _cfill_guess: ["Investor preferences for use of funds?"],
    };
    expect(confirmPatch(ov, "country")).toEqual({ set: { _cfill_contact: ["_website_source"] }, remove: ["_country_source"] });
  });
  it("does nothing for a stated field", () => {
    expect(confirmPatch({ _cfill_contact: ["_website_source"] }, "Investor short bio")).toEqual({ set: {}, remove: [] });
  });
});

describe("Odoo mapping", () => {
  const schema: EditableFieldDesc[] = [
    { name: "x_inv_ind", label: "Investor interested in type(s) of business industries?", control: "multiselect", relation: "x_ind", options: [{ value: "1", label: "Healthcare" }, { value: "2", label: "Fintech" }] },
    { name: "x_ent_ind", label: "Entrepreneur type of industries?", control: "multiselect", relation: "x_ind", options: [{ value: "1", label: "Healthcare" }] },
    { name: "x_deals", label: "Investor preferences for the number of deals per year?", control: "select", options: [{ value: "lt5", label: "Less than 5 Deals" }, { value: "5_10", label: "5 - 10 Deals" }] },
    { name: "x_bio", label: "Investor short bio", control: "textarea" },
  ];
  it("finds the field by label, the Industries alias on the contact's side", () => {
    expect(odooFieldFor(schema, "Industries", "Investor")?.name).toBe("x_inv_ind");
    expect(odooFieldFor(schema, "Industries", "Entrepreneur")?.name).toBe("x_ent_ind");
    expect(odooFieldFor(schema, "investor short bio", "Investor")?.name).toBe("x_bio");
    expect(odooFieldFor(schema, "Something else", "Investor")).toBeNull();
  });
  it("maps labels to option ids and refuses values Odoo doesn't have", () => {
    expect(odooValue(schema[0], ["Fintech", "healthcare"])).toEqual({ ok: true, value: ["2", "1"] });
    expect(odooValue(schema[0], ["Space"])).toEqual({ ok: false, reason: "\"Space\" is not an option in Odoo" });
    expect(odooValue(schema[2], ["Less than 5 Deals"])).toEqual({ ok: true, value: "lt5" });
    expect(odooValue(schema[2], ["Less than 5 Deals", "5 - 10 Deals"])).toEqual({ ok: false, reason: "Odoo takes one value here" });
    expect(odooValue(schema[2], [])).toEqual({ ok: true, value: "" });
    expect(odooValue(schema[3], ["Invests in medtech."])).toEqual({ ok: true, value: "Invests in medtech." });
  });
  it("knows its column fields", () => {
    expect(isColumnField("website")).toBe(true);
    expect(isColumnField("Industries")).toBe(false);
  });
});
