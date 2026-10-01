import { describe, it, expect } from "vitest";
import {
  autoMatch, validateMapping, applyMapping, parseCsvCells, splitHeader, customKeyOf, normHeader, contactTypeOf,
  type ColumnMapping, type SavedMapping,
} from "./field-mapping";

describe("normHeader and customKeyOf", () => {
  it("normalises headers", () => {
    expect(normHeader("  Company_Name ")).toBe("company name");
    expect(normHeader("E-mail")).toBe("e mail");
  });
  it("makes stable keys", () => {
    expect(customKeyOf("Ticket size")).toBe("ticket_size");
    expect(customKeyOf("AUM (€)")).toBe("aum");
    expect(customKeyOf("2026 budget")).toBe("f_2026_budget");
    expect(customKeyOf("Fundación año")).toBe("fundacion_ano");
  });
});

describe("autoMatch", () => {
  const rows = [["Maya Chen", "maya@lumenbio.com", "+33 6 12 34 56 78", "Series A", "250k–1M USD"], ["Dan", "", "", "Seed+", ""]];
  const cols = ["Name", "Email", "Mobile", "x_fund_stage", "Ticket size"];

  it("matches by key, label and alias, leaves the rest for a decision", () => {
    const m = autoMatch(cols, [], rows);
    expect(m.map((x) => [x.column, x.status, x.target ?? null])).toEqual([
      ["Name", "exact", "name"], ["Email", "exact", "email"], ["Mobile", "alias", "phone"],
      ["x_fund_stage", "none", null], ["Ticket size", "none", null],
    ]);
    expect(m[3].samples).toEqual(["Series A", "Seed+"]);
  });

  it("uses saved decisions first, including custom and ignore", () => {
    const saved: SavedMapping[] = [
      { source_column: "x_fund_stage", action: "map", target_field: "stage", custom_key: null },
      { source_column: "Ticket size", action: "custom", target_field: null, custom_key: "ticket_size" },
      { source_column: "Mobile", action: "ignore", target_field: null, custom_key: null },
    ];
    const m = autoMatch(cols, saved, rows);
    expect(m[3]).toMatchObject({ status: "saved", action: "map", target: "stage" });
    expect(m[4]).toMatchObject({ status: "saved", action: "custom", customKey: "ticket_size" });
    expect(m[2]).toMatchObject({ status: "saved", action: "ignore" });
  });

  it("never sends two columns to one field", () => {
    const m = autoMatch(["Email", "E-mail"], []);
    expect(m[0].target).toBe("email");
    expect(m[1].status).toBe("none");
  });

  it("does not loosely match headers that only contain a field name", () => {
    const m = autoMatch(["Email status", "Company size"], []);
    expect(m.every((x) => x.status === "none")).toBe(true);
  });
});

describe("validateMapping", () => {
  const cols = ["Name", "Email", "Ticket size"];
  it("blocks undecided columns and a missing name", () => {
    const mapping: ColumnMapping[] = [{ column: "Email", action: "map", target: "email" }];
    const p = validateMapping(cols, mapping, []);
    expect(p.map((x) => x.column ?? "*")).toEqual(["Name", "Ticket size", "*"]);
  });
  it("blocks a column nobody decided even if it has a default", () => {
    const mapping: ColumnMapping[] = [
      { column: "Name", action: "map", target: "name" }, { column: "Email", action: "map", target: "email" }, { column: "Ticket size", action: "ignore" },
    ];
    expect(validateMapping(cols, mapping, [], new Set(["Name", "Email"]))).toHaveLength(1);
    expect(validateMapping(cols, mapping, [], new Set(cols))).toEqual([]);
  });
  it("needs a name for a new custom field and rejects duplicates and unknown targets", () => {
    const mapping: ColumnMapping[] = [
      { column: "Name", action: "map", target: "name" }, { column: "Email", action: "map", target: "name" }, { column: "Ticket size", action: "custom", customLabel: " " },
    ];
    expect(validateMapping(cols, mapping, []).map((x) => x.column)).toEqual(["Email", "Ticket size"]);
    expect(validateMapping(["Name", "X"], [{ column: "Name", action: "map", target: "name" }, { column: "X", action: "map", target: "tags" }], [])[0].message).toBe("Unknown field.");
  });
});

describe("applyMapping", () => {
  it("keeps values exactly as received", () => {
    const cols = ["Name", "Mobile 2", "Ticket size", "Junk", "Type"];
    const rows = [["  Maya Chen ", "+33 6 12 34 56 78", "250k–1M USD", "x", "Entrepreneur"]];
    const mapping: ColumnMapping[] = [
      { column: "Name", action: "map", target: "name" },
      { column: "Mobile 2", action: "map", target: "phone" },
      { column: "Ticket size", action: "custom", customKey: "ticket_size" },
      { column: "Junk", action: "ignore" },
      { column: "Type", action: "map", target: "contact_type" },
    ];
    const [r] = applyMapping(cols, rows, mapping, { ticket_size: "Ticket size" });
    expect(r.fields).toEqual({ name: "Maya Chen", phone: "+33 6 12 34 56 78", contact_type: "founder" });
    expect(r.custom).toEqual({ "Ticket size": "250k–1M USD" });
  });
  it("uses the new custom label when the field doesn't exist yet and skips empty cells", () => {
    const [r] = applyMapping(["N", "AUM"], [["A", ""]], [{ column: "N", action: "map", target: "name" }, { column: "AUM", action: "custom", customLabel: "AUM" }], {});
    expect(r.custom).toEqual({});
    const [r2] = applyMapping(["N", "AUM"], [["A", "€45 M"]], [{ column: "N", action: "map", target: "name" }, { column: "AUM", action: "custom", customLabel: "AUM" }], {});
    expect(r2.custom).toEqual({ AUM: "€45 M" });
  });
});

describe("contactTypeOf", () => {
  it("classifies like the old import", () => {
    expect(["Entrepreneur", "Founder", "INVESTOR", "Advisor", "Partner"].map(contactTypeOf)).toEqual(["founder", "founder", "investor", "advisor", "other"]);
  });
});

describe("parseCsvCells and splitHeader", () => {
  it("parses quotes, commas, CRLF and a BOM", () => {
    const text = "﻿Name,Note\r\n\"Chen, Maya\",\"said \"\"hi\"\"\"\r\n\r\nDan,x\n";
    const { columns, rows } = splitHeader(parseCsvCells(text));
    expect(columns).toEqual(["Name", "Note"]);
    expect(rows).toEqual([["Chen, Maya", "said \"hi\""], ["Dan", "x"]]);
  });
  it("names blank header cells", () => {
    expect(splitHeader([["Name", ""], ["a", "b"]]).columns).toEqual(["Name", "Column 2"]);
  });
});
