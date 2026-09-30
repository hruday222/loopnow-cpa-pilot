import type { ExpenseAnalysis } from "../domain/analysis";
import type { Receipt } from "../domain/receipt";

import {
    buildExpenseAnalysis,
    hasMalformedAnalysisToolResult,
  } from "./build-expense-analysis";
import {
  buildProcessingSummary,
} from "./build-processing-summary";
import {
  verifyAnalysis,
  type AnalysisVerificationResult,
} from "./verify-processing";

type ToolResult = {
  toolName: string;
  input?: unknown;
  output: unknown;
};

export type FinalizeRunInput = {
  receipt: Receipt;
  toolResults: ToolResult[];
  baseAnalysis?: ExpenseAnalysis;
  agentText: string;
};

export type FinalizeRunResult = {
  analysis: ExpenseAnalysis;
  verification: AnalysisVerificationResult;
  summary: string;
  shouldApplyClassification: boolean;
  agentText: string;
};

function toolResultBelongsToReceipt(
  toolResult: ToolResult,
  receiptId: string,
): boolean {
  if (!toolResult.input || typeof toolResult.input !== "object") {
    return false;
  }

  const input = toolResult.input as {
    receiptId?: unknown;
  };

  return input.receiptId === receiptId;
}

export function finalizeRun(
  input: FinalizeRunInput,
): FinalizeRunResult {
  const {
    receipt,
    toolResults,
    baseAnalysis,
    agentText,
  } = input;

  const analysis = buildExpenseAnalysis(
    receipt.id,
    toolResults,
    baseAnalysis,
  );

  const verification = verifyAnalysis(
    receipt,
    analysis,
  );

  const hasMalformedToolResult =
  hasMalformedAnalysisToolResult(
    receipt.id,
    toolResults,
  );

if (hasMalformedToolResult) {
  verification.status = "failed";
  verification.failures.push(
    "One or more tool results were malformed and could not be safely verified.",
  );
}

  /*
   * A classification mutation is allowed only when:
   *
   * 1. this run actually produced a classification result,
   * 2. that classification result belongs to the current receipt,
   * 3. the complete analysis passed deterministic verification,
   * 4. the resulting classification is structurally valid.
   */
  const currentRunProducedClassification =
    toolResults.some(
      (result) =>
        result.toolName === "classify_expense" &&
        toolResultBelongsToReceipt(result, receipt.id),
    );

  const shouldApplyClassification =
    verification.status === "passed" &&
    currentRunProducedClassification &&
    analysis.classification?.status === "classified" &&
    analysis.classification.transactionType !== null &&
    analysis.classification.category !== null;

  const summary =
    toolResults.length === 0
      ? agentText
      : buildProcessingSummary(
          receipt,
          analysis,
          verification,
        );

  return {
    analysis,
    verification,
    summary,
    shouldApplyClassification,
    agentText,
  };
}