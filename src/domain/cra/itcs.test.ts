import { describe, expect, it } from "vitest";

import { calculateEligibleItc } from "./itc";

describe("calculateEligibleItc", () => {
  it("calculates 100% ITC for a fully documented standard expense", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 100,
      isMeal: false,
      documentationStatus: "sufficient",
    });

    expect(result).toEqual({
      category: "office",
      grossTax: 10,
      eligibilityPercentage: 1,
      eligibleItc: 10,
      reasonCode: "STANDARD_ITC",
      status: "eligible",
      rule: {
        ruleVersion: "2026.09.1",
        source: "CRA",
        sourceId: "cra-itc",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
      },
    });
  });

  it("applies the 50% meal restriction", () => {
    const result = calculateEligibleItc({
      subtotal: 240,
      taxAmount: 12,
      taxType: "GST",
      category: "meals",
      commercialUsePercentage: 100,
      isMeal: true,
      documentationStatus: "sufficient",
    });

    expect(result).toEqual({
      category: "meals",
      grossTax: 12,
      eligibilityPercentage: 0.5,
      eligibleItc: 6,
      reasonCode: "BUSINESS_MEAL_50_PERCENT",
      status: "partial",
      rule: {
        ruleVersion: "2026.09.1",
        source: "CRA",
        sourceId: "cra-itc",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
      },
    });
  });

  it("applies commercial use percentage", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 50,
      isMeal: false,
      documentationStatus: "sufficient",
    });

    expect(result).toEqual({
      category: "office",
      grossTax: 10,
      eligibilityPercentage: 1,
      eligibleItc: 5,
      reasonCode: "STANDARD_ITC",
      status: "partial",
      rule: {
        ruleVersion: "2026.09.1",
        source: "CRA",
        sourceId: "cra-itc",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
      },
    });
  });

  it("requires review when documentation is incomplete", () => {
    const result = calculateEligibleItc({
      subtotal: 1200,
      taxAmount: 60,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 100,
      isMeal: false,
      documentationStatus: "insufficient",
    });

    expect(result).toEqual({
      category: "office",
      grossTax: 60,
      eligibilityPercentage: 0,
      eligibleItc: 0,
      reasonCode: "DOCUMENTATION_INCOMPLETE",
      status: "review",
      rule: {
        ruleVersion: "2026.09.1",
        source: "CRA",
        sourceId: "cra-itc",
        url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
      },
    });
  });

  it("uses the standard 50% meal policy", () => {
    const result = calculateEligibleItc({
      subtotal: 240,
      taxAmount: 12,
      taxType: "GST",
      category: "Business meals",
      commercialUsePercentage: 100,
      isMeal: true,
      mealPolicy: "standard",
      documentationStatus: "sufficient",
    });
  
    expect(result.eligibilityPercentage).toBe(0.5);
    expect(result.eligibleItc).toBe(6);
    expect(result.reasonCode).toBe("BUSINESS_MEAL_50_PERCENT");
  });
  
  it("supports the 100% meal exception", () => {
    const result = calculateEligibleItc({
      subtotal: 240,
      taxAmount: 12,
      taxType: "GST",
      category: "Business meals",
      commercialUsePercentage: 100,
      isMeal: true,
      mealPolicy: "charity_or_public_institution",
      documentationStatus: "sufficient",
    });
  
    expect(result.eligibilityPercentage).toBe(1);
    expect(result.eligibleItc).toBe(12);
  });

  it("rounds eligible ITC to two decimal places", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10.01,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 33.333,
      isMeal: false,
      documentationStatus: "sufficient",
    });
  
    expect(result.grossTax).toBe(10.01);
    expect(result.eligibleItc).toBe(3.34);
  });
  
  it("rounds gross tax to two decimal places", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10.005,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 100,
      isMeal: false,
      documentationStatus: "sufficient",
    });
  
    expect(result.grossTax).toBe(10.01);
    expect(result.eligibleItc).toBe(10.01);
  });
  
  it("does not expose floating-point noise in partial ITC", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 33.33,
      isMeal: false,
      documentationStatus: "sufficient",
    });
  
    expect(result.eligibleItc).toBe(3.33);
  });

  it("returns zero ITC for zero commercial use", () => {
    const result = calculateEligibleItc({
      subtotal: 100,
      taxAmount: 10,
      taxType: "GST",
      category: "office",
      commercialUsePercentage: 0,
      isMeal: false,
      documentationStatus: "sufficient",
    });
  
    expect(result.eligibleItc).toBe(0);
    expect(result.status).toBe("ineligible");
  });
  
  it("supports the 80% long-haul truck driver exception", () => {
    const result = calculateEligibleItc({
      subtotal: 240,
      taxAmount: 12,
      taxType: "GST",
      category: "Business meals",
      commercialUsePercentage: 100,
      isMeal: true,
      mealPolicy: "long_haul_truck_driver",
      documentationStatus: "sufficient",
    });
  
    expect(result.eligibilityPercentage).toBe(0.8);
    expect(result.eligibleItc).toBe(9.6);
  });

  it("rejects commercial use percentages outside 0-100", () => {
    expect(() =>
      calculateEligibleItc({
        subtotal: 100,
        taxAmount: 10,
        taxType: "GST",
        category: "office",
        commercialUsePercentage: 101,
        isMeal: false,
        documentationStatus: "sufficient",
      }),
    ).toThrow("Commercial use percentage must be between 0 and 100.");
  });
});