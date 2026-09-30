import { describe, expect, it } from "vitest";

import { finalizeRun } from "./finalize-processing";

import { receipts } from "../domain/receipt";

describe("finalizeRun", () => {
  const officeReceipt = receipts.find(
    (receipt) => receipt.id === "rct-001",
  );

  const restaurantReceipt = receipts.find(
    (receipt) => receipt.id === "rct-002",
  );

  if (!officeReceipt || !restaurantReceipt) {
    throw new Error("Test receipts not found.");
  }

  it("returns agent text without state mutation when no tools were used", () => {
    const result = finalizeRun({
      receipt: officeReceipt,
      toolResults: [],
      agentText: "GST is a consumption tax.",
    });

    expect(result.summary).toBe(
      "GST is a consumption tax.",
    );

    expect(result.shouldApplyClassification).toBe(false);
  });

  it("does not authorize classification from an incomplete classification run", () => {
    const result = finalizeRun({
      receipt: officeReceipt,
      toolResults: [
        {
          toolName: "classify_expense",
          output: {
            receiptId: "rct-001",
            transactionType: "expense",
            category: "office_expenses",
            confidence: 0.95,
            status: "classified",
            reasonCode: "CLASSIFIED",
          },
        },
      ],
      agentText: "",
    });

    expect(result.verification.status).toBe(
      "incomplete",
    );

    expect(
      result.shouldApplyClassification,
    ).toBe(false);
  });

  it("does not authorize classification when only GIFI was produced", () => {
    const result = finalizeRun({
      receipt: officeReceipt,
      toolResults: [
        {
          toolName: "assign_gifi_code",
          output: {
            receiptId: "rct-001",
            gifiCode: "8810",
            description: "Office expenses",
            category: "office_expenses",
            status: "accepted",
            confidence: 0.95,
          },
        },
      ],
      agentText: "",
    });

    expect(
      result.shouldApplyClassification,
    ).toBe(false);
  });

  it("preserves a previously completed analysis for a partial follow-up run", () => {
    const baseAnalysis = {
      receiptId: "rct-002",
      documentation: {
        status: "sufficient" as const,
        tier: "150_or_more" as const,
        reasonCode: "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
      gstHst: {
        status: "valid_format" as const,
        normalizedNumber: "987456321RT0001",
        reasonCode: "VALID_FORMAT",
      },
      classification: {
        status: "classified" as const,
        transactionType: "expense" as const,
        category: "meals_and_entertainment" as const,
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
      itc: {
        category: "meals_and_entertainment",
        grossTax: 12,
        eligibilityPercentage: 50,
        eligibleItc: 6,
        reasonCode: "STANDARD_MEAL_ITC_50_PERCENT",
        status: "eligible" as const,
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
      gifi: {
        receiptId: "rct-002",
        gifiCode: "8523",
        description: "Meals and entertainment",
        category: "meals_and_entertainment",
        status: "accepted" as const,
        confidence: 0.95,
        reasonCode: "GIFI_ASSIGNED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = finalizeRun({
      receipt: restaurantReceipt,
      baseAnalysis,
      toolResults: [
        {
          toolName: "assign_gifi_code",
          output: {
            receiptId: "rct-002",
            gifiCode: "8523",
            description: "Meals and entertainment",
            category: "meals_and_entertainment",
            status: "accepted",
            confidence: 0.95,
          },
        },
      ],
      agentText: "",
    });

    expect(result.analysis.classification).toEqual(
      baseAnalysis.classification,
    );

    expect(result.analysis.itc).toEqual(
      baseAnalysis.itc,
    );

    expect(
      result.shouldApplyClassification,
    ).toBe(false);
  });
});