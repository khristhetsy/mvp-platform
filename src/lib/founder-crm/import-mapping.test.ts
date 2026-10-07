import { describe, expect, it } from "vitest";
import { applyImportMapping, autoMap, findHeader } from "./import-mapping";
import { parseCsvCells } from "@/lib/contacts/field-mapping";

describe("founder contact import mapping", () => {
  it("finds the LinkedIn header under the Notes lines and maps it", () => {
    const csv = [
      "Notes:",
      '"When exporting your connection data, you may notice that some of the email addresses are missing."',
      "",
      "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
      "Ada,Lovelace,https://www.linkedin.com/in/ada,ada@av.com,Analytical Ventures,Partner,01 Oct 2026",
      "Alan,Turing,https://www.linkedin.com/in/alan,,Bletchley Capital,GP,02 Oct 2026",
    ].join("\n");
    const { columns, rows, linkedin } = findHeader(parseCsvCells(csv));
    expect(linkedin).toBe(true);
    expect(columns[0]).toBe("First Name");
    const mapping = autoMap(columns);
    expect(mapping).toEqual(["first_name", "last_name", "linkedin_url", "email", "firm_name", "position", "skip"]);
    const out = applyImportMapping(rows, mapping);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      investor_name: "Ada Lovelace",
      email: "ada@av.com",
      firm_name: "Analytical Ventures",
      linkedin_url: "https://www.linkedin.com/in/ada",
      notes: "Title: Partner",
    });
    expect(out.noEmail).toBe(1);
  });

  it("drops duplicates against existing contacts and within the file", () => {
    const rows = [
      ["Ada Lovelace", "ADA@av.com"],
      ["Ada L", "ada@av.com"],
      ["Grace Hopper", "grace@navy.mil"],
      ["", "nobody@x.com"],
    ];
    const out = applyImportMapping(rows, ["full_name", "email"], ["grace@navy.mil"]);
    expect(out.rows.map((r) => r.investor_name)).toEqual(["Ada Lovelace"]);
    expect(out.duplicates).toBe(2);
    expect(out.missingName).toBe(1);
  });

  it("does not map the same field twice", () => {
    expect(autoMap(["Name", "Contact", "Email"])).toEqual(["full_name", "skip", "email"]);
  });
});
