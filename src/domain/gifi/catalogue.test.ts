import { describe, expect, it } from "vitest";
import { findGifiCode, gifiCatalogue } from "./catalogue";

describe("GIFI catalogue", () => {
  it("contains the controlled GIFI catalogue entries", () => {
    expect(gifiCatalogue.map((item) => item.code)).toEqual([
      "1001",
      "8810",
      "8523",
      "9270",
    ]);
  });

  it("contains all required catalogue fields", () => {
    for (const item of gifiCatalogue) {
      expect(item.code).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.parentCategory).toBeTruthy();
      expect(item.applicableExpenseTypes.length).toBeGreaterThan(0);
      expect(["high", "medium", "low"]).toContain(item.confidence);
      expect(item.source).toBeTruthy();
    }
  });

  it("finds a valid GIFI code", () => {
    const result = findGifiCode("8810");

    expect(result).toEqual({
      code: "8810",
      description: "Office expenses",
      category: "Office Expenses",
      parentCategory: "Operating Expenses",
      applicableExpenseTypes: ["expense"],
      confidence: "high",
      source: "CRA",
      sourceUrl:
        "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    });
  });

  it("trims whitespace when looking up a GIFI code", () => {
    const result = findGifiCode(" 8810 ");

    expect(result?.code).toBe("8810");
  });

  it("returns null for an unknown GIFI code", () => {
    const result = findGifiCode("999999");

    expect(result).toBeNull();
  });

  it("contains a cash classification for cash deposits", () => {
    const result = findGifiCode("1001");

    expect(result?.description).toBe("Cash");
    expect(result?.applicableExpenseTypes).toContain("cash_deposit");
  });
});