import { describe, expect, it } from "vitest";
import type { ExpenseAnalysis } from "@/domain/analysis";
import {
    buildExpenseAnalysis,
    hasMalformedAnalysisToolResult,
  } from "./build-expense-analysis";

describe("buildExpenseAnalysis", () => {
  it("builds an analysis from relevant tool results", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "validate_cra_documentation",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-001",
          status: "sufficient",
          rule: {
            ruleVersion: "2026.09.1",
            source: "CRA rule set",
          },
          tier: "30_to_under_150",
          reasonCode: "DOCUMENTATION_SUFFICIENT",
          missingRequirements: [],
        },
      },
      {
        toolName: "validate_gst_hst_number",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-001",
          status: "valid_format",
          normalizedNumber: "123456789RT0001",
          reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
        },
      },
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-001",
          status: "classified",
          transactionType: "expense",
          category: "office_expenses",
          confidence: 0.95,
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
      {
        toolName: "calculate_eligible_itc",
        input: {
          receiptId: "rct-001",
        },
        output: {
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
      },
      {
        toolName: "assign_gifi_code",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-001",
          status: "accepted",
          source: {
            ruleVersion: "2026.09.1",
            source: "CRA",
          },
          gifiCode: "8810",
          description: "Office expenses",
          category: "Office Expenses",
          reasonCode: "GIFI_CODE_VALIDATED",
        },
      },
      {
        toolName: "lookup_gifi_candidates",
        input: {
          category: "office_expenses",
          transactionType: "expense",
        },
        output: {
          status: "candidates_found",
          candidates: [],
          reasonCode: "GIFI_CANDIDATES_FOUND",
        },
      },
    ]);

    expect(analysis.receiptId).toBe("rct-001");
    expect(analysis.documentation?.status).toBe("sufficient");
    expect(analysis.gstHst?.status).toBe("valid_format");
    expect(analysis.classification?.category).toBe(
      "office_expenses",
    );
    expect(analysis.itc?.eligibleItc).toBe(4.1);
    expect(analysis.gifi?.gifiCode).toBe("8810");
  });

  it("preserves existing analysis when only one new tool result is provided", () => {
    const baseAnalysis: ExpenseAnalysis = {
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
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "office_expenses",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
    };

    const result = buildExpenseAnalysis(
      "rct-001",
      [
        {
          toolName: "assign_gifi_code",
          input: {
            receiptId: "rct-001",
          },
          output: {
            receiptId: "rct-001",
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
        },
      ],
      baseAnalysis,
    );

    expect(result.documentation).toEqual(
      baseAnalysis.documentation,
    );
    expect(result.classification).toEqual(
      baseAnalysis.classification,
    );
    expect(result.gifi?.gifiCode).toBe("8810");
  });

  it("does not preserve analysis belonging to a different receipt", () => {
    const baseAnalysis: ExpenseAnalysis = {
      receiptId: "rct-002",
      classification: {
        status: "classified",
        transactionType: "expense",
        category: "meals_and_entertainment",
        confidence: 0.95,
        reasonCode: "CLASSIFIED",
      },
    };

    const result = buildExpenseAnalysis(
      "rct-001",
      [],
      baseAnalysis,
    );

    expect(result).toEqual({
      receiptId: "rct-001",
    });
  });

  it("ignores tool results belonging to a different receipt", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-002",
        },
        output: {
          receiptId: "rct-002",
          status: "classified",
          transactionType: "expense",
          category: "meals_and_entertainment",
          confidence: 0.95,
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-001",
          status: "classified",
          transactionType: "expense",
          category: "office_expenses",
          confidence: 0.95,
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
    ]);

    expect(analysis.classification?.category).toBe(
      "office_expenses",
    );
  });

  it("rejects a tool result when its input and output receipt IDs disagree", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-001",
        },
        output: {
          receiptId: "rct-002",
          status: "classified",
          transactionType: "expense",
          category: "meals_and_entertainment",
          confidence: 0.95,
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
    ]);

    expect(analysis.classification).toBeUndefined();
  });

  it("ignores malformed classification output", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-001",
        },
        output: {
          status: "classified",
          transactionType: "expense",
          category: "office_expenses",
          confidence: "high",
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
    ]);

    expect(analysis.classification).toBeUndefined();
  });

  it("ignores malformed ITC output", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "calculate_eligible_itc",
        input: {
          receiptId: "rct-001",
        },
        output: {
          category: "office_expenses",
          grossTax: 4.1,
          eligibilityPercentage: 1,
          eligibleItc: "4.10",
          reasonCode: "STANDARD_ITC",
          status: "eligible",
          rule: {
            ruleVersion: "2026.09.1",
            source: "CRA rule set",
          },
        },
      },
    ]);

    expect(analysis.itc).toBeUndefined();
  });

  it("ignores malformed GIFI output", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "assign_gifi_code",
        input: {
          receiptId: "rct-001",
        },
        output: {
          status: "accepted",
          gifiCode: 8810,
          description: "Office expenses",
          category: "Office Expenses",
          reasonCode: "GIFI_CODE_VALIDATED",
          source: {
            ruleVersion: "2026.09.1",
            source: "CRA",
          },
        },
      },
    ]);

    expect(analysis.gifi).toBeUndefined();
  });

  it("detects malformed analysis tool output", () => {
    const toolResults = [
      {
        toolName: "classify_expense",
        input: {
          receiptId: "rct-001",
        },
        output: {
          status: "classified",
          transactionType: "expense",
          category: "office_expenses",
          confidence: "high",
          reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
        },
      },
    ];

    expect(
      hasMalformedAnalysisToolResult(
        "rct-001",
        toolResults,
      ),
    ).toBe(true);
  });

  it("does not treat GIFI candidate lookup as a final GIFI assignment", () => {
    const analysis = buildExpenseAnalysis("rct-001", [
      {
        toolName: "lookup_gifi_candidates",
        input: {
          category: "office_expenses",
          transactionType: "expense",
        },
        output: {
          status: "candidates_found",
          candidates: [
            {
              code: "8810",
            },
          ],
          reasonCode: "GIFI_CANDIDATES_FOUND",
        },
      },
    ]);

    expect(analysis.gifi).toBeUndefined();
  });
});