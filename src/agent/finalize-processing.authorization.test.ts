import { describe, expect, it } from "vitest";

import { getReceiptDetails } from "../domain/receipt";
import { classifyExpense } from "../domain/classification/expense";
import { calculateEligibleItc } from "../domain/cra/itc";
import { validateCraDocumentation } from "../domain/cra/documentation";
import { validateGstHstNumberFormat } from "../domain/cra/gst-hst";
import { assignGifiCode } from "../domain/gifi/assignment";
import {
  finalizeRun,
  type FinalizeRunInput,
} from "./finalize-processing";

function getDocumentationInput(
  receiptId: string,
) {
  const receipt = getReceiptDetails(receiptId);

  return {
    receiptAvailable: receipt.receiptAvailable,
    evidence: {
      supplierName: receipt.vendor,
      invoiceDate: receipt.date,
      totalAmount: receipt.total,
      gstHstNumber: receipt.gstHstNumber,
      taxAmount: receipt.gst,
      taxIncluded: receipt.taxIncluded,
      taxRate: receipt.taxRate,
      recipientName: receipt.recipientName,
      paymentTerms: receipt.paymentTerms,
      supplyDescription: receipt.supplyDescription,
    },
  };
}

function buildValidToolResults(receiptId: string) {
  const receipt = getReceiptDetails(receiptId);

  const documentation = validateCraDocumentation(
    getDocumentationInput(receiptId),
  );

  const gstHst = validateGstHstNumberFormat(
    receipt.gstHstNumber,
  );

  const classification = classifyExpense({
    actualTransactionType: receipt.transactionType,
    proposedTransactionType: "expense",
    category: "office_expenses",
    confidence: 0.95,
  });

  const itc = calculateEligibleItc({
    subtotal: receipt.subtotal,
    taxAmount: receipt.gst,
    taxType: "GST",
    category: "office_expenses",
    commercialUsePercentage:
      receipt.commercialUsePercentage,
    isMeal: false,
    documentationStatus: documentation.status,
  });

  const gifi = assignGifiCode({
    gifiCode: "8810",
    transactionType: receipt.transactionType,
    confidence: 0.95,
  });

  return [
    {
      toolName: "validate_cra_documentation",
      input: {
        receiptId,
      },
      output: documentation,
    },
    {
      toolName: "validate_gst_hst_number",
      input: {
        receiptId,
      },
      output: gstHst,
    },
    {
      toolName: "classify_expense",
      input: {
        receiptId,
        proposedTransactionType: "expense",
        category: "office_expenses",
        confidence: 0.95,
      },
      output: classification,
    },
    {
      toolName: "calculate_eligible_itc",
      input: {
        receiptId,
        category: "office_expenses",
      },
      output: itc,
    },
    {
      toolName: "assign_gifi_code",
      input: {
        receiptId,
        gifiCode: "8810",
        confidence: 0.95,
      },
      output: gifi,
    },
  ];
}

describe("finalizeRun classification authorization", () => {
  it("authorizes a valid current-run classification", () => {
    const receipt = getReceiptDetails("rct-001");

    const input: FinalizeRunInput = {
      receipt,
      toolResults: buildValidToolResults("rct-001"),
      agentText: "Process the receipt.",
    };

    const result = finalizeRun(input);

    expect(result.verification.status).toBe("passed");

    expect(
      result.analysis.classification?.status,
    ).toBe("classified");

    expect(
      result.analysis.classification?.transactionType,
    ).toBe("expense");

    expect(
      result.analysis.classification?.category,
    ).toBe("office_expenses");

    expect(result.shouldApplyClassification).toBe(true);
  });

  it("does not authorize classification when the current run did not produce classification", () => {
    const receipt = getReceiptDetails("rct-001");

    const toolResults = buildValidToolResults(
      "rct-001",
    ).filter(
      (result) =>
        result.toolName !== "classify_expense",
    );

    const input: FinalizeRunInput = {
      receipt,
      toolResults,
      agentText: "Process the receipt.",
    };

    const result = finalizeRun(input);

    expect(result.verification.status).toBe(
      "incomplete",
    );

    expect(
      result.analysis.classification,
    ).toBeUndefined();

    expect(
      result.shouldApplyClassification,
    ).toBe(false);
  });

  it("does not authorize classification when verification fails", () => {
    const receipt = getReceiptDetails("rct-001");

    const toolResults = buildValidToolResults(
      "rct-001",
    ).map((result) => {
      if (
        result.toolName !==
        "assign_gifi_code"
      ) {
        return result;
      }

      return {
        ...result,
        input: {
          receiptId: "rct-001",
          gifiCode: "8523",
          confidence: 0.95,
        },
        output: assignGifiCode({
          gifiCode: "8523",
          transactionType: "expense",
          confidence: 0.95,
        }),
      };
    });

    const input: FinalizeRunInput = {
      receipt,
      toolResults,
      agentText: "Process the receipt.",
    };

    const result = finalizeRun(input);

    expect(result.verification.status).toBe(
      "failed",
    );

    expect(
      result.shouldApplyClassification,
    ).toBe(false);
  });
});