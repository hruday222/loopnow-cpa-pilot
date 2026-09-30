import { describe, expect, it } from "vitest";

import { verifyAnalysis } from "./verify-processing";
import type { ExpenseAnalysis } from "../domain/analysis";
import { getReceiptDetails } from "../domain/receipt";

describe("verifyAnalysis", () => {
  it("passes a correctly processed office expense", () => {
    const receipt = getReceiptDetails("rct-001");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-001",

      documentation: {
        status: "sufficient",
        tier: "30_to_under_150",
        reasonCode: "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gstHst: {
        status: "valid_format",
        normalizedNumber: "123456789RT0001",
        reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
      },

      classification: {
        status: "classified",
        transactionType: "expense",
        category: "office_expenses",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },

      itc: {
        category: "office_expenses",
        grossTax: 4.1,
        eligibilityPercentage: 1,
        eligibleItc: 4.1,
        reasonCode: "STANDARD_ITC",
        status: "eligible",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gifi: {
        status: "accepted",
        gifiCode: "8810",
        description: "Office expenses",
        category: "Office Expenses",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("passed");
    expect(result.failures).toEqual([]);

    expect(result.checks).toEqual({
      receipt: "passed",
      documentation: "passed",
      gstHst: "passed",
      classification: "passed",
      itc: "passed",
      gifi: "passed",
    });
  });

  it("passes a restaurant expense with the standard 50% ITC", () => {
    const receipt = getReceiptDetails("rct-002");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-002",

      documentation: {
        status: "sufficient",
        tier: "150_or_more",
        reasonCode: "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gstHst: {
        status: "valid_format",
        normalizedNumber: "987654321RT0001",
        reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
      },

      classification: {
        status: "classified",
        transactionType: "expense",
        category: "meals_and_entertainment",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },

      itc: {
        category: "meals_and_entertainment",
        grossTax: 12,
        eligibilityPercentage: 0.5,
        eligibleItc: 6,
        reasonCode: "BUSINESS_MEAL_50_PERCENT",
        status: "partial",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gifi: {
        status: "accepted",
        gifiCode: "8523",
        description: "Meals and entertainment",
        category: "Meals and Entertainment",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("passed");
    expect(result.checks.itc).toBe("passed");
  });

  it("fails when ITC was calculated using a different category than the validated classification", () => {
    const receipt = getReceiptDetails("rct-002");
  
    const analysis: ExpenseAnalysis = {
      receiptId: "rct-002",
  
      documentation: {
        status: "sufficient",
        tier: "150_or_more",
        reasonCode: "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gstHst: {
        status: "valid_format",
        normalizedNumber: "987654321RT0001",
        reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
      },
  
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "meals_and_entertainment",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
  
      itc: {
        // Deliberately wrong: classification says meals.
        // ITC result says office expenses.
        category: "office_expenses",
        grossTax: 12,
        eligibilityPercentage: 0.5,
        eligibleItc: 6,
        reasonCode: "BUSINESS_MEAL_50_PERCENT",
        status: "partial",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gifi: {
        status: "accepted",
        gifiCode: "8523",
        description: "Meals and entertainment",
        category: "Meals and Entertainment",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };
  
    const result = verifyAnalysis(receipt, analysis);
  
    expect(result.status).toBe("failed");
    expect(result.checks.itc).toBe("failed");
  });

  it("returns incomplete when only classification has been run", () => {
    const receipt = getReceiptDetails("rct-001");
  
    const analysis: ExpenseAnalysis = {
      receiptId: "rct-001",
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "office_expenses",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
    };
  
    const result = verifyAnalysis(receipt, analysis);
  
    expect(result.status).toBe("incomplete");
    expect(result.checks.classification).toBe("passed");
    expect(result.checks.documentation).toBe("not_run");
    expect(result.checks.gstHst).toBe("not_run");
    expect(result.checks.itc).toBe("not_run");
    expect(result.checks.gifi).toBe("not_run");
    expect(result.failures).toHaveLength(0);
  });

  it("returns failed when a classification result exists but is invalid", () => {
    const receipt = getReceiptDetails("rct-001");
  
    const analysis: ExpenseAnalysis = {
      receiptId: "rct-001",
      classification: {
        status: "review_required",
        transactionType: "expense",
        category: "office_expenses",
        confidence: 0.4,
        reasonCode: "LOW_CONFIDENCE",
      },
    };
  
    const result = verifyAnalysis(receipt, analysis);
  
    expect(result.status).toBe("failed");
    expect(result.checks.classification).toBe("failed");
    expect(result.failures).toContain(
      "Classification is invalid or inconsistent."
    );
  });

  it("routes insufficient documentation to review instead of technical error", () => {
    const receipt = getReceiptDetails("rct-003");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-003",

      documentation: {
        status: "insufficient",
        tier: "150_or_more",
        reasonCode: "DOCUMENTATION_REQUIREMENTS_MISSING",
        missingRequirements: [
          "invoice_date",
          "gst_hst_number",
          "recipient_name",
          "payment_terms",
          "supply_description",
        ],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gstHst: {
        status: "missing",
        normalizedNumber: null,
        reasonCode: "GST_HST_NUMBER_MISSING",
      },

      classification: {
        status: "classified",
        transactionType: "expense",
        category: "other_expenses",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },

      itc: {
        category: "other_expenses",
        grossTax: 60,
        eligibilityPercentage: 0,
        eligibleItc: 0,
        reasonCode: "DOCUMENTATION_INCOMPLETE",
        status: "review",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },

      gifi: {
        status: "accepted",
        gifiCode: "9270",
        description: "Other expenses",
        category: "Other Expenses",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("incomplete");
    expect(result.checks.documentation).toBe("review");
    expect(result.checks.gstHst).toBe("review");
    expect(result.failures).toContain(
      "CRA documentation requires review.",
    );
  });

  it("fails when the agent provides an incorrect ITC amount", () => {
    const receipt = getReceiptDetails("rct-002");
  
    const analysis: ExpenseAnalysis = {
      receiptId: "rct-002",
  
      documentation: {
        status: "sufficient",
        tier: "150_or_more",
        reasonCode: "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gstHst: {
        status: "valid_format",
        normalizedNumber: "987654321RT0001",
        reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
      },
  
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "meals_and_entertainment",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
  
      // Deliberately incorrect: deterministic calculation should be 6.00.
      itc: {
        category: "meals_and_entertainment",
        grossTax: 12,
        eligibilityPercentage: 0.5,
        eligibleItc: 12,
        reasonCode: "BUSINESS_MEAL_50_PERCENT",
        status: "partial",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gifi: {
        status: "accepted",
        gifiCode: "8523",
        description: "Meals and entertainment",
        category: "Meals and Entertainment",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };
  
    const result = verifyAnalysis(receipt, analysis);
  
    expect(result.status).toBe("failed");
    expect(result.checks.itc).toBe("failed");
    expect(result.failures).toContain(
      "ITC result failed deterministic verification.",
    );
  });

  it("fails when a restaurant meal is assigned office-expense GIFI 8810", () => {
    const receipt = getReceiptDetails("rct-002");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-002",
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "meals_and_entertainment",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
      itc: {
        category: "meals_and_entertainment",
        grossTax: 12,
        eligibilityPercentage: 0.5,
        eligibleItc: 6,
        reasonCode: "BUSINESS_MEAL_50_PERCENT",
        status: "partial",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
      gifi: {
        status: "accepted",
        gifiCode: "8810",
        description: "Office expenses",
        category: "Office Expenses",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("failed");
    expect(result.checks.gifi).toBe("failed");
    expect(result.failures).toContain(
      "GIFI code is not valid for the validated classification.",
    );
  });

  it("fails when a cash deposit is assigned office-expense GIFI 8810", () => {
    const receipt = getReceiptDetails("rct-004");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-004",
      classification: {
        status: "classified",
        transactionType: "cash_deposit",
        category: "cash",
        confidence: 0.95,
        reasonCode: "CASH_DEPOSIT",
      },
      gifi: {
        status: "accepted",
        gifiCode: "8810",
        description: "Office expenses",
        category: "Office Expenses",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("failed");
    expect(result.checks.gifi).toBe("failed");
  });

  it("fails closed when a restaurant receipt is classified as office expense", () => {
    const receipt =
      getReceiptDetails("rct-002");
  
    const analysis: ExpenseAnalysis = {
      receiptId: "rct-002",
  
      documentation: {
        status: "sufficient",
        tier: "150_or_more",
        reasonCode:
          "DOCUMENTATION_SUFFICIENT",
        missingRequirements: [],
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gstHst: {
        status: "valid_format",
        normalizedNumber:
          "987654321RT0001",
        reasonCode:
          "GST_HST_NUMBER_VALID_FORMAT",
      },
  
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "office_expenses",
        confidence: 0.99,
        reasonCode: "CLASSIFIED",
      },
  
      itc: {
        category: "office_expenses",
        grossTax: 12,
        eligibilityPercentage: 1,
        eligibleItc: 12,
        reasonCode:
          "STANDARD_ITC",
        status: "eligible",
        rule: {
          ruleVersion: "2026.09.1",
          source: "CRA rule set",
        },
      },
  
      gifi: {
        status: "accepted",
        gifiCode: "8810",
        description:
          "Office expenses",
        category:
          "Office Expenses",
        reasonCode:
          "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };
  
    const result =
      verifyAnalysis(
        receipt,
        analysis,
      );
  
    expect(
      result.status,
    ).toBe("failed");
  
    expect(
      result.checks.classification,
    ).toBe("failed");
  
    expect(
      result.checks.itc,
    ).toBe("failed");
  
    expect(
      result.failures,
    ).toContain(
      "Classification is invalid or inconsistent.",
    );
  
    expect(
      result.failures,
    ).toContain(
      "ITC result failed deterministic verification.",
    );
  });

  it("returns incomplete when only GIFI assignment has been run", () => {
    const receipt = getReceiptDetails("rct-001");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-001",
      gifi: {
        status: "accepted",
        gifiCode: "8810",
        description: "Office expenses",
        category: "Office Expenses",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("incomplete");
    expect(result.checks.gifi).toBe("not_run");
    expect(result.failures).toHaveLength(0);
  });

  it("passes a cash deposit without requiring documentation or GST/HST", () => {
    const receipt = getReceiptDetails("rct-004");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-004",

      classification: {
        status: "classified",
        transactionType: "cash_deposit",
        category: "cash",
        confidence: 0.95,
        reasonCode: "CASH_DEPOSIT",
      },

      gifi: {
        status: "accepted",
        gifiCode: "1001",
        description: "Cash",
        category: "Cash",
        reasonCode: "GIFI_CODE_VALIDATED",
        source: {
          ruleVersion: "2026.09.1",
          source: "CRA",
        },
      },
    };

    const result = verifyAnalysis(receipt, analysis);

    expect(result.status).toBe("passed");

    expect(result.checks).toEqual({
      receipt: "passed",
      documentation: "not_applicable",
      gstHst: "not_applicable",
      classification: "passed",
      itc: "not_applicable",
      gifi: "passed",
    });
  });
});