import { tool } from "ai";
import { z } from "zod";

import { validateCraDocumentation } from "@/domain/cra/documentation";
import { calculateEligibleItc } from "@/domain/cra/itc";
import { validateGstHstNumberFormat } from "@/domain/cra/gst-hst";
import { classifyExpense } from "@/domain/classification/expense";
import {
  inferDeterministicExpenseCategory,
} from "@/domain/classification/deterministic-category";
import { lookupGifiCandidates } from "@/domain/gifi/lookup";
import { assignGifiCode } from "@/domain/gifi/assignment";
import { getPersistedReceipt } from "@/db/repository";
import type { ExpenseCategory } from "@/domain/classification/expense";

const categorySchema = z.enum([
  "office_expenses",
  "meals_and_entertainment",
  "other_expenses",
  "cash",
]);

const transactionTypeSchema = z.enum([
  "expense",
  "cash_deposit",
]);

const receiptIdSchema = z.string().min(1);

export const agentToolInputSchemas = {
  get_current_receipt: z.object({}).strict(),
  get_receipt_details: z.object({ receiptId: receiptIdSchema }).strict(),
  validate_cra_documentation: z.object({ receiptId: receiptIdSchema }).strict(),
  validate_gst_hst_number: z.object({ receiptId: receiptIdSchema }).strict(),
  classify_expense: z
    .object({
      receiptId: receiptIdSchema,
      proposedTransactionType: transactionTypeSchema,
      category: categorySchema,
      confidence: z.number().finite().min(0).max(1),
    })
    .strict(),
  calculate_eligible_itc: z
    .object({
      receiptId: receiptIdSchema,
      category: categorySchema,
    })
    .strict(),
  lookup_gifi_candidates: z
    .object({
      category: categorySchema,
      transactionType: transactionTypeSchema,
    })
    .strict(),
  assign_gifi_code: z
    .object({
      receiptId: receiptIdSchema,
      gifiCode: z.string().trim().min(1).max(32),
      confidence: z.number().finite().min(0).max(1),
    })
    .strict(),
  update_expense_classification: z
    .object({
      receiptId: receiptIdSchema,
      proposedTransactionType: transactionTypeSchema,
      category: categorySchema,
    })
    .strict(),
  request_human_review: z
    .object({
      receiptId: receiptIdSchema,
      reason: z.string().trim().min(1).max(2000),
    })
    .strict(),
  get_processing_status: z
    .object({ receiptId: receiptIdSchema })
    .strict(),
};

export type AgentToolContext = {
  runId: string;
  receiptId: string;
};

function maybeForceEvaluationToolFailure(toolName: string) {
  if (
    process.env.NODE_ENV === "test" &&
    process.env.EVAL_FORCE_TOOL_FAILURE === toolName
  ) {
    throw new Error(`Evaluation-forced tool failure: ${toolName}`);
  }
}

function requireSelectedReceipt(
  context: AgentToolContext,
  receiptId: string,
) {
  if (receiptId !== context.receiptId) {
    throw new Error(
      `Tool access denied: run ${context.runId} is scoped to ${context.receiptId}.`,
    );
  }

  return getPersistedReceipt(receiptId);
}

function documentationEvidence(
  receipt: ReturnType<
    typeof getPersistedReceipt
  >,
) {
  return {
    supplierName: receipt.vendor,
    invoiceDate: receipt.date,
    totalAmount: receipt.total,
    gstHstNumber: receipt.gstHstNumber,
    taxAmount: receipt.gst,
    taxIncluded: receipt.taxIncluded,
    taxRate: receipt.taxRate,
    recipientName: receipt.recipientName,
    paymentTerms: receipt.paymentTerms,
    supplyDescription:
      receipt.supplyDescription,
  };
}

export function createAgentTools(
  context: AgentToolContext,
) {
  return {
    get_current_receipt: tool({
      description:
        "Returns the receipt currently selected by the application for this agent run. Never accepts an arbitrary receipt ID.",
      inputSchema: agentToolInputSchemas.get_current_receipt,
      execute: async () => {
        maybeForceEvaluationToolFailure("get_current_receipt");
        return getPersistedReceipt(
          context.receiptId,
        );
      },
    }),

    get_receipt_details: tool({
      description:
        "Returns authoritative details for the selected receipt. This run cannot access another receipt.",
      inputSchema: agentToolInputSchemas.get_receipt_details,
      execute: async ({ receiptId }) =>
        requireSelectedReceipt(
          context,
          receiptId,
        ),
    }),

    validate_cra_documentation: tool({
      description:
        "Deterministically validates CRA documentation requirements using receipt facts from the server database.",
      inputSchema: agentToolInputSchemas.validate_cra_documentation,
      execute: async ({ receiptId }) => {
        maybeForceEvaluationToolFailure("validate_cra_documentation");
        const receipt =
          requireSelectedReceipt(
            context,
            receiptId,
          );

        return validateCraDocumentation({
          receiptAvailable:
            receipt.receiptAvailable,
          evidence:
            documentationEvidence(
              receipt,
            ),
        });
      },
    }),

    validate_gst_hst_number: tool({
      description:
        "Deterministically validates the GST/HST account number format. A valid format does not prove CRA registration.",
      inputSchema: agentToolInputSchemas.validate_gst_hst_number,
      execute: async ({ receiptId }) => {
        maybeForceEvaluationToolFailure("validate_gst_hst_number");
        const receipt =
          requireSelectedReceipt(
            context,
            receiptId,
          );

        return validateGstHstNumberFormat(
          receipt.gstHstNumber,
        );
      },
    }),

    classify_expense: tool({
      description:
        "Validates an expense classification against the authoritative transaction type stored on the selected receipt.",
      inputSchema: agentToolInputSchemas.classify_expense,
      execute: async (input) => {
        maybeForceEvaluationToolFailure("classify_expense");
        const receipt =
          requireSelectedReceipt(
            context,
            input.receiptId,
          );

        return classifyExpense({
          actualTransactionType:
            receipt.transactionType,
          proposedTransactionType:
            input.proposedTransactionType,
          category: input.category,
          confidence:
            input.confidence,
        });
      },
    }),

    calculate_eligible_itc: tool({
      description:
        "Deterministically calculates eligible GST/HST ITC. Tax amount, tax type, commercial use, documentation, and meal treatment are derived from authoritative receipt state. The model-proposed category cannot override deterministic receipt signals.",
      inputSchema: agentToolInputSchemas.calculate_eligible_itc,
      execute: async ({
        receiptId,
        category,
      }) => {
        maybeForceEvaluationToolFailure("calculate_eligible_itc");
        const receipt =
          requireSelectedReceipt(
            context,
            receiptId,
          );

        if (
          receipt.transactionType ===
          "cash_deposit"
        ) {
          return {
            category: "cash",
            grossTax: 0,
            eligibilityPercentage: 0,
            eligibleItc: 0,
            reasonCode:
              "CASH_DEPOSIT_NOT_ELIGIBLE_FOR_ITC",
            status: "ineligible" as const,
            rule: {
              ruleVersion:
                "2026.09.1",
              source:
                "CRA rule set",
            },
          };
        }

        /*
         * The category supplied by the model is only a proposal.
         *
         * Derive the category signal from authoritative
         * receipt facts before calculating ITC.
         */
        const deterministicCategory =
          inferDeterministicExpenseCategory(
            receipt,
          );

        /*
         * Unknown category means we cannot safely determine
         * whether a meal limitation or another category-specific
         * treatment applies.
         */
        if (!deterministicCategory) {
          return {
            category,
            grossTax: receipt.gst,
            eligibilityPercentage: 0,
            eligibleItc: 0,
            reasonCode:
              "CATEGORY_REQUIRES_HUMAN_REVIEW",
            status: "review" as const,
            rule: {
              ruleVersion:
                "2026.09.1",
              source:
                "CRA rule set",
            },
          };
        }

        /*
         * If the model disagrees with deterministic receipt
         * evidence, fail closed into review.
         */
        if (
          category !==
          deterministicCategory
        ) {
          return {
            category,
            grossTax: receipt.gst,
            eligibilityPercentage: 0,
            eligibleItc: 0,
            reasonCode:
              "CATEGORY_MISMATCH_REQUIRES_HUMAN_REVIEW",
            status: "review" as const,
            rule: {
              ruleVersion:
                "2026.09.1",
              source:
                "CRA rule set",
            },
          };
        }

        const documentation =
          validateCraDocumentation({
            receiptAvailable:
              receipt.receiptAvailable,
            evidence:
              documentationEvidence(
                receipt,
              ),
          });

        /*
         * Crucially, both category and meal treatment come from
         * the deterministic receipt signal.
         */
        return calculateEligibleItc({
          subtotal:
            receipt.subtotal,
          taxAmount:
            receipt.gst,
          taxType:
            receipt.taxType,
          category:
            deterministicCategory,
          commercialUsePercentage:
            receipt.commercialUsePercentage,
          isMeal:
            deterministicCategory ===
            "meals_and_entertainment",
          documentationStatus:
            documentation.status,
        });
      },
    }),

    lookup_gifi_candidates: tool({
      description:
        "Looks up GIFI candidates from the controlled catalogue. It never invents codes.",
      inputSchema: agentToolInputSchemas.lookup_gifi_candidates,
      execute: async ({
        category,
        transactionType,
      }) =>
        lookupGifiCandidates({
          category:
            category as ExpenseCategory,
          transactionType,
        }),
    }),

    assign_gifi_code: tool({
      description:
        "Validates an agent-proposed GIFI code against the controlled catalogue and the selected receipt transaction type.",
      inputSchema: agentToolInputSchemas.assign_gifi_code,
      execute: async ({
        receiptId,
        gifiCode,
        confidence,
      }) => {
        const receipt =
          requireSelectedReceipt(
            context,
            receiptId,
          );

        return assignGifiCode({
          gifiCode,
          transactionType:
            receipt.transactionType,
          confidence,
        });
      },
    }),

    update_expense_classification: tool({
      description:
        "Records a proposed classification only. It does not mutate financial state; the server verifies and authorizes the mutation after the run.",
      inputSchema: agentToolInputSchemas.update_expense_classification,
      execute: async (input) => {
        requireSelectedReceipt(
          context,
          input.receiptId,
        );

        return {
          status:
            "proposal_only" as const,
          receiptId:
            input.receiptId,
          proposedTransactionType:
            input.proposedTransactionType,
          category:
            input.category,
        };
      },
    }),

    request_human_review: tool({
      description:
        "Creates a pending human review request. Use this for missing/ambiguous business evidence or other conditions that prevent safe completion.",
      inputSchema: agentToolInputSchemas.request_human_review,
      execute: async ({
        receiptId,
        reason,
      }) => {
        requireSelectedReceipt(
          context,
          receiptId,
        );

        return {
          status:
            "review_requested" as const,
          receiptId,
          reason,
        };
      },
    }),

    get_processing_status: tool({
      description:
        "Returns persisted processing status for the selected receipt.",
      inputSchema: agentToolInputSchemas.get_processing_status,
      execute: async ({
        receiptId,
      }) => {
        const receipt =
          requireSelectedReceipt(
            context,
            receiptId,
          );

        return {
          receiptId,
          stage:
            receipt.processingStatus,
        };
      },
    }),
  };
}