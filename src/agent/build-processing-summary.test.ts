import { describe, expect, it } from "vitest";

import { buildProcessingSummary } from "./build-processing-summary";

import type { ExpenseAnalysis } from "../domain/analysis";
import type { AnalysisVerificationResult } from "./verify-processing";
import { getReceiptDetails } from "../domain/receipt";

describe("buildProcessingSummary", () => {
  it("summarizes a partial classification result", () => {
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

    const verification: AnalysisVerificationResult = {
      status: "incomplete",
      checks: {
        receipt: "passed",
        documentation: "not_run",
        gstHst: "not_run",
        classification: "passed",
        itc: "not_run",
        gifi: "not_run",
      },
      failures: [],
    };

    const summary = buildProcessingSummary(
      receipt,
      analysis,
      verification,
    );

    expect(summary).toContain(
      "Receipt rct-001 analysis is incomplete.",
    );
    expect(summary).toContain(
      "Transaction type: expense",
    );
    expect(summary).toContain(
      "Category: office_expenses",
    );
    expect(summary).toContain(
      "Not run: CRA documentation validation, GST/HST validation, ITC calculation, GIFI assignment.",
    );
  });

  it("summarizes an ITC result as provisional when classification is not validated", () => {
    const receipt = getReceiptDetails("rct-001");

    const analysis: ExpenseAnalysis = {
      receiptId: "rct-001",
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
    };

    const verification: AnalysisVerificationResult = {
      status: "incomplete",
      checks: {
        receipt: "passed",
        documentation: "not_run",
        gstHst: "not_run",
        classification: "not_run",
        itc: "passed",
        gifi: "not_run",
      },
      failures: [],
    };

    const summary = buildProcessingSummary(
      receipt,
      analysis,
      verification,
    );

    expect(summary).toContain("Eligible ITC: $4.10");
    expect(summary).toContain(
      "The ITC calculation is provisional because the expense classification has not been validated.",
    );
  });

  it("summarizes a failed verification as requiring review", () => {
    const receipt = getReceiptDetails("rct-003");

    const analysis: ExpenseAnalysis = {
        receiptId: "rct-003",
        documentation: {
          status: "insufficient",
          tier: "150_or_more",
          reasonCode: "DOCUMENTATION_REQUIREMENTS_MISSING",
          missingRequirements: [
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
      };

    const verification: AnalysisVerificationResult = {
      status: "failed",
      checks: {
        receipt: "passed",
        documentation: "failed",
        gstHst: "failed",
        classification: "not_run",
        itc: "not_run",
        gifi: "not_run",
      },
      failures: [
        "CRA documentation is not sufficient.",
        "GST/HST number format is not valid.",
      ],
    };

    const summary = buildProcessingSummary(
      receipt,
      analysis,
      verification,
    );

    expect(summary).toContain(
      "Receipt rct-003 requires review.",
    );
    expect(summary).toContain(
    "CRA documentation is insufficient for ITC approval.",
    );
    expect(summary).toContain(
    "Missing requirements: gst_hst_number, recipient_name, payment_terms, supply_description.",
    );
    expect(summary).toContain(
    "Eligible ITC remains $0.00 until the required documentation is obtained and validated.",
    );
    expect(summary).toContain(
    "GST/HST number: missing.",
    );
  });
});