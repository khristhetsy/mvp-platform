import { describe, it, expect } from "vitest";
import { fieldToPdfRect, resolveAutoValue } from "./compute";
import type { SignatureField } from "./types";

function field(partial: Partial<SignatureField>): SignatureField {
  return {
    id: "f1",
    request_id: "r1",
    field_type: "text",
    page: 1,
    x: 0,
    y: 0,
    width: 0.2,
    height: 0.05,
    required: true,
    auto_source: null,
    placeholder: null,
    value: null,
    created_at: "",
    ...partial,
  };
}

describe("fieldToPdfRect", () => {
  const PW = 600;
  const PH = 800;

  it("maps a top-left normalized box to bottom-left pdf coordinates", () => {
    // Box at top-left of the page (y=0 from the top) sits near the page TOP in
    // pdf-lib space (high `bottom` value).
    const r = fieldToPdfRect(field({ x: 0, y: 0, width: 0.5, height: 0.1 }), PW, PH);
    expect(r.left).toBe(0);
    expect(r.width).toBe(300);
    expect(r.height).toBe(80);
    expect(r.bottom).toBe(800 - 0 - 80); // 720
  });

  it("flips the Y axis correctly for a box lower on the page", () => {
    const r = fieldToPdfRect(field({ x: 0.25, y: 0.5, width: 0.2, height: 0.05 }), PW, PH);
    expect(r.left).toBe(150);
    expect(r.bottom).toBe(800 - 400 - 40); // 360
  });

  it("places a bottom-edge box at the page floor", () => {
    const r = fieldToPdfRect(field({ x: 0, y: 0.95, width: 0.1, height: 0.05 }), PW, PH);
    expect(Math.round(r.bottom)).toBe(0);
  });
});

describe("resolveAutoValue", () => {
  it("fills date fields with the signing date", () => {
    expect(resolveAutoValue(field({ field_type: "date" }), "2026-06-21", null)).toBe("2026-06-21");
  });

  it("fills company fields with the signer company", () => {
    expect(resolveAutoValue(field({ field_type: "company" }), "2026-06-21", "Northwind AI")).toBe("Northwind AI");
  });

  it("honors auto_source even when field_type differs", () => {
    expect(resolveAutoValue(field({ field_type: "text", auto_source: "signing_date" }), "2026-06-21", null)).toBe("2026-06-21");
  });

  it("returns empty string (not null) for a company field with no company set", () => {
    expect(resolveAutoValue(field({ field_type: "company" }), "2026-06-21", null)).toBe("");
  });

  it("returns null for signer-provided fields (signature / text)", () => {
    expect(resolveAutoValue(field({ field_type: "signature" }), "2026-06-21", "X")).toBeNull();
    expect(resolveAutoValue(field({ field_type: "text" }), "2026-06-21", "X")).toBeNull();
  });
});
