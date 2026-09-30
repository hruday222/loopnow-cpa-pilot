import { z } from "zod";

import type { ExpenseAnalysis } from "@/domain/analysis";

type ToolResult = {
  toolName: string;
  input?: unknown;
  output: unknown;
};

const ruleMetadataSchema = z.object({
  ruleVersion: z.string(),
  source: z.string(),
});

const documentationResultSchema = z.object({
  status: z.enum(["sufficient", "insufficient", "review"]),
  tier: z.enum([
    "under_30",
    "30_to_under_150",
    "150_or_more",
  ]),
  reasonCode: z.string(),
  missingRequirements: z.array(
    z.enum([
      "supplier_name",
      "invoice_date",
      "total_amount",
      "gst_hst_number",
      "tax_information",
      "recipient_name",
      "payment_terms",
      "supply_description",
    ]),
  ),
  rule: ruleMetadataSchema,
});

const gstHstResultSchema = z.object({
  status: z.enum([
    "valid_format",
    "invalid_format",
    "missing",
    "malformed",
    "suspicious",
    "unknown",
  ]),
  normalizedNumber: z.string().nullable(),
  reasonCode: z.string(),
});

const classificationResultSchema = z.object({
  status: z.enum(["classified", "review_required"]),
  transactionType: z.enum(["expense", "cash_deposit"]).nullable(),
  category: z.enum([
    "office_expenses",
    "meals_and_entertainment",
    "other_expenses",
    "cash",
  ]).nullable(),
  confidence: z.number(),
  reasonCode: z.string(),
});

const itcResultSchema = z.object({
  category: z.string(),
  grossTax: z.number(),
  eligibilityPercentage: z.number(),
  eligibleItc: z.number(),
  reasonCode: z.string(),
  status: z.enum([
    "eligible",
    "partial",
    "ineligible",
    "review",
  ]),
  rule: ruleMetadataSchema,
});

const gifiResultSchema = z.object({
  status: z.enum(["accepted", "review_required"]),
  gifiCode: z.string().nullable(),
  description: z.string().nullable(),
  category: z.string().nullable(),
  reasonCode: z.string(),
  source: ruleMetadataSchema,
});

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function belongsToReceipt(
  toolResult: ToolResult,
  receiptId: string,
): boolean {
  if (!isRecord(toolResult.input)) {
    return false;
  }

  if (toolResult.input.receiptId !== receiptId) {
    return false;
  }

  // If the tool output contains a receiptId, it must also match.
  if (
    isRecord(toolResult.output) &&
    "receiptId" in toolResult.output &&
    toolResult.output.receiptId !== receiptId
  ) {
    return false;
  }

  return true;
}

function isValidAnalysisToolOutput(
  toolName: string,
  output: unknown,
): boolean {
  switch (toolName) {
    case "validate_cra_documentation":
      return documentationResultSchema.safeParse(output).success;

    case "validate_gst_hst_number":
      return gstHstResultSchema.safeParse(output).success;

    case "classify_expense":
      return classificationResultSchema.safeParse(output).success;

    case "calculate_eligible_itc":
      return itcResultSchema.safeParse(output).success;

    case "assign_gifi_code":
      return gifiResultSchema.safeParse(output).success;

    default:
      return true;
  }
}

export function hasMalformedAnalysisToolResult(
  receiptId: string,
  toolResults: ToolResult[],
): boolean {
  return toolResults.some(
    (toolResult) =>
      belongsToReceipt(toolResult, receiptId) &&
      !isValidAnalysisToolOutput(
        toolResult.toolName,
        toolResult.output,
      ),
  );
}

export function buildExpenseAnalysis(
  receiptId: string,
  toolResults: ToolResult[],
  baseAnalysis?: ExpenseAnalysis,
): ExpenseAnalysis {
  const analysis: ExpenseAnalysis =
    baseAnalysis?.receiptId === receiptId
      ? { ...baseAnalysis }
      : { receiptId };

  for (const toolResult of toolResults) {
    if (!isRecord(toolResult.output)) {
      continue;
    }

    if (!belongsToReceipt(toolResult, receiptId)) {
      continue;
    }

    if (
      !isValidAnalysisToolOutput(
        toolResult.toolName,
        toolResult.output,
      )
    ) {
      continue;
    }

    switch (toolResult.toolName) {
      case "validate_cra_documentation":
        analysis.documentation =
          toolResult.output as ExpenseAnalysis["documentation"];
        break;

      case "validate_gst_hst_number":
        analysis.gstHst =
          toolResult.output as ExpenseAnalysis["gstHst"];
        break;

      case "classify_expense":
        analysis.classification =
          toolResult.output as ExpenseAnalysis["classification"];
        break;

      case "calculate_eligible_itc":
        analysis.itc =
          toolResult.output as ExpenseAnalysis["itc"];
        break;

      case "assign_gifi_code":
        analysis.gifi =
          toolResult.output as ExpenseAnalysis["gifi"];
        break;

      default:
        break;
    }
  }

  return analysis;
}