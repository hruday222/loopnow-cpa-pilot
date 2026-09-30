import { describe, expect, it } from "vitest";
import {
  validateCraDocumentation,
  type DocumentationEvidence,
} from "./documentation";

function completeEvidence(
  overrides: Partial<DocumentationEvidence> = {},
): DocumentationEvidence {
  return {
    supplierName: "Test Supplier",
    invoiceDate: "2026-09-18",
    totalAmount: 100,
    gstHstNumber: "123456789RT0001",
    taxAmount: 5,
    taxIncluded: false,
    taxRate: 5,
    recipientName: "Test Company",
    paymentTerms: "Due on receipt",
    supplyDescription: "Office supplies",
    ...overrides,
  };
}

describe("validateCraDocumentation", () => {
  it("uses the under-$30 tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 29.99,
      }),
    });

    expect(result.tier).toBe("under_30");
    expect(result.status).toBe("sufficient");
  });

  it("uses the $30 to under-$150 tier at exactly $30", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 30,
      }),
    });

    expect(result.tier).toBe("30_to_under_150");
    expect(result.status).toBe("sufficient");
  });

  it("keeps $30.01 in the middle tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 30.01,
      }),
    });

    expect(result.tier).toBe("30_to_under_150");
  });

  it("keeps $149.99 in the middle tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 149.99,
      }),
    });

    expect(result.tier).toBe("30_to_under_150");
  });

  it("uses the $150-or-more tier at exactly $150", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 150,
      }),
    });

    expect(result.tier).toBe("150_or_more");
    expect(result.status).toBe("sufficient");
  });

  it("keeps amounts above $150 in the highest tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 150.01,
      }),
    });

    expect(result.tier).toBe("150_or_more");
  });

  it("requires the GST/HST number in the middle tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 100,
        gstHstNumber: null,
      }),
    });

    expect(result.status).toBe("insufficient");
    expect(result.missingRequirements).toContain("gst_hst_number");
  });

  it("requires recipient, payment terms and description in the highest tier", () => {
    const result = validateCraDocumentation({
      receiptAvailable: true,
      evidence: completeEvidence({
        totalAmount: 1200,
        recipientName: null,
        paymentTerms: null,
        supplyDescription: null,
      }),
    });

    expect(result.status).toBe("insufficient");

    expect(result.missingRequirements).toEqual([
      "recipient_name",
      "payment_terms",
      "supply_description",
    ]);
  });

  it("identifies missing documentation when the receipt is unavailable", () => {
    const result = validateCraDocumentation({
      receiptAvailable: false,
      evidence: completeEvidence({
        totalAmount: 100,
      }),
    });

    expect(result.status).toBe("review");
    expect(result.reasonCode).toBe("RECEIPT_MISSING");
  });

  it("rejects NaN amounts", () => {
    expect(() =>
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: NaN,
        }),
      }),
    ).toThrow("Total amount must be a finite number.");
  });
  
  it("rejects positive Infinity", () => {
    expect(() =>
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: Infinity,
        }),
      }),
    ).toThrow("Total amount must be a finite number.");
  });
  
  it("rejects negative Infinity", () => {
    expect(() =>
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: -Infinity,
        }),
      }),
    ).toThrow("Total amount must be a finite number.");
  });

  it("treats thresholds as inclusive lower bounds", () => {
    expect(
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: 30,
        }),
      }).tier,
    ).toBe("30_to_under_150");
  
    expect(
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: 150,
        }),
      }).tier,
    ).toBe("150_or_more");
  });

  it("rejects negative amounts", () => {
    expect(() =>
      validateCraDocumentation({
        receiptAvailable: true,
        evidence: completeEvidence({
          totalAmount: -1,
        }),
      }),
    ).toThrow("Total amount cannot be negative.");
  });
});