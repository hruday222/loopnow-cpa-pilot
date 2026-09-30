import { describe, expect, it } from "vitest";
import { assignGifiCode } from "./assignment";

describe("assignGifiCode", () => {
  it("accepts a valid high-confidence office expense classification", () => {
    const result = assignGifiCode({
      gifiCode: "8810",
      transactionType: "expense",
      confidence: 0.94,
    });

    expect(result).toEqual({
      status: "accepted",
      gifiCode: "8810",
      description: "Office expenses",
      category: "Office Expenses",
      reasonCode: "GIFI_CODE_VALIDATED",
      source: {
        ruleVersion: "2026.09.1",
        source: "CRA",
      },
    });
  });

  it("accepts a valid high-confidence meal classification", () => {
    const result = assignGifiCode({
      gifiCode: "8523",
      transactionType: "expense",
      confidence: 0.95,
    });

    expect(result.status).toBe("accepted");
    expect(result.gifiCode).toBe("8523");
  });

  it("accepts a cash classification for a cash deposit", () => {
    const result = assignGifiCode({
      gifiCode: "1001",
      transactionType: "cash_deposit",
      confidence: 0.99,
    });

    expect(result.status).toBe("accepted");
    expect(result.gifiCode).toBe("1001");
  });

  it("rejects an unknown GIFI code", () => {
    const result = assignGifiCode({
      gifiCode: "999999",
      transactionType: "expense",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "review_required",
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CODE_NOT_IN_CATALOGUE",
      source: {
        ruleVersion: "2026.09.1",
        source: "CRA",
      },
    });
  });

  it("rejects a GIFI code incompatible with the expense type", () => {
    const result = assignGifiCode({
      gifiCode: "1001",
      transactionType: "expense",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "review_required",
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CODE_INCOMPATIBLE_WITH_EXPENSE_TYPE",
      source: {
        ruleVersion: "2026.09.1",
        source: "CRA",
      },
    });
  });

  it("routes low-confidence classifications to review", () => {
    const result = assignGifiCode({
      gifiCode: "8810",
      transactionType: "expense",
      confidence: 0.6,
    });

    expect(result).toEqual({
      status: "review_required",
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CLASSIFICATION_LOW_CONFIDENCE",
      source: {
        ruleVersion: "2026.09.1",
        source: "CRA",
      },
    });
  });

  it("rejects confidence below zero", () => {
    expect(() =>
      assignGifiCode({
        gifiCode: "8810",
        transactionType: "expense",
        confidence: -0.1,
      }),
    ).toThrow("Confidence must be between 0 and 1.");
  });

  it("rejects confidence above one", () => {
    expect(() =>
      assignGifiCode({
        gifiCode: "8810",
        transactionType: "expense",
        confidence: 1.1,
      }),
    ).toThrow("Confidence must be between 0 and 1.");
  });
});