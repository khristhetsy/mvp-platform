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
    expect(mapping).toEqual(["first_name", "last_name", "linkedin_url", "email", "firm_name", "position", "connected_on"]);
    const out = applyImportMapping(rows, mapping);
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      investor_name: "Ada Lovelace",
      email: "ada@av.com",
      firm_name: "Analytical Ventures",
      linkedin_url: "https://www.linkedin.com/in/ada",
      notes: "Title: Partner\nConnected on: 01 Oct 2026",
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

  it("maps phone and investor profile columns and saves them on the row", () => {
    const columns = ["Name", "E-mail", "Mobile", "Fund", "Type", "Focus", "Round", "Ticket", "HQ", "Twitter", "Crunchbase"];
    const mapping = autoMap(columns);
    expect(mapping).toEqual([
      "full_name", "email", "phone", "firm_name", "investor_type", "sector", "stage", "check_size", "geography", "twitter_url", "crunchbase_url",
    ]);
    const out = applyImportMapping(
      [["Ada Lovelace", "ada@av.com", "+1 415 555 0142", "Analytical Ventures", "VC", "Fintech", "Seed", "250k-1m", "SF", "twitter.com/ada", "crunchbase.com/person/ada"]],
      mapping,
    );
    expect(out.rows[0]).toMatchObject({
      phone: "+1 415 555 0142",
      investor_type: "VC",
      sector: "Fintech",
      stage: "Seed",
      check_size: "250k-1m",
      geography: "SF",
      twitter_url: "twitter.com/ada",
      crunchbase_url: "crunchbase.com/person/ada",
    });
  });

  it("keeps rows whose email is already a contact when duplicates are filled in", () => {
    const rows = [
      ["Ada Lovelace", "ada@av.com", "+1 415 555 0142"],
      ["Ada Again", "ADA@av.com", ""],
      ["Grace Hopper", "grace@navy.mil", "+1 202 555 0100"],
    ];
    const mapping = ["full_name", "email", "phone"] as const;
    const fill = applyImportMapping(rows, [...mapping], ["grace@navy.mil"], { duplicateMode: "fill" });
    expect(fill.rows.map((r) => r.investor_name)).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(fill.updateRows.map((r) => r.investor_name)).toEqual(["Grace Hopper"]);
    expect(fill.existing).toBe(1);
    expect(fill.duplicates).toBe(1);

    const skip = applyImportMapping(rows, [...mapping], ["grace@navy.mil"], { duplicateMode: "skip" });
    expect(skip.rows.map((r) => r.investor_name)).toEqual(["Ada Lovelace"]);
    expect(skip.updateRows).toEqual([]);
    expect(skip.duplicates).toBe(2);
  });

  it("lists the rows that need a look with the file's own cells", () => {
    const rows = [
      ["Ada Lovelace", ""],
      ["", "nobody@x.com"],
      ["Grace Hopper", "grace@navy.mil"],
      ["Grace H", "grace@navy.mil"],
    ];
    const out = applyImportMapping(rows, ["full_name", "email"]);
    expect(out.attention.map((a) => a.reason)).toEqual(["No email", "No name", "Duplicate email"]);
    expect(out.attention[1].cells).toEqual(["", "nobody@x.com"]);
  });
});
