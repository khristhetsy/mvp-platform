import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createServiceRoleClient: () => ({}) }));

import { companyFolderName, DRIVE_ROOT_FOLDER } from "./drive";
import { CONTRACT_TYPES, CONTRACT_TYPE_LABEL, isContractType } from "./types";

describe("companyFolderName", () => {
  it("keeps the company name readable", () => {
    expect(companyFolderName("Arrayworks, Inc.")).toBe("Arrayworks, Inc.");
  });
  it("removes slashes and extra spaces", () => {
    expect(companyFolderName("  A/B  Holdings\\\\Ltd ")).toBe("A B Holdings Ltd");
  });
  it("falls back when there is no company", () => {
    expect(companyFolderName(null)).toBe("Other");
    expect(companyFolderName("   ")).toBe("Other");
  });
  it("files under the iCapOS Contracts folder", () => {
    expect(DRIVE_ROOT_FOLDER).toBe("iCapOS Contracts");
  });
});

describe("contract types", () => {
  it("lists the five upload types in order", () => {
    expect(CONTRACT_TYPES.map((t) => t.label)).toEqual(["Due Diligence Services", "SAFE", "Convertible Note", "Series A", "Stock and Cash"]);
  });
  it("validates keys", () => {
    expect(isContractType("safe")).toBe(true);
    expect(isContractType("nda")).toBe(false);
    expect(CONTRACT_TYPE_LABEL.stock_and_cash).toBe("Stock and Cash");
  });
});
