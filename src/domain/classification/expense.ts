import type { TransactionType } from "@/domain/types";

export type ExpenseCategory =
  | "office_expenses"
  | "meals_and_entertainment"
  | "other_expenses"
  | "cash";

export type ClassificationStatus =
  | "classified"
  | "review_required";

export type ClassifyExpenseInput = {
    actualTransactionType: TransactionType;
    proposedTransactionType: TransactionType;
    category: ExpenseCategory;
    confidence: number;
  };

export type ClassifyExpenseResult = {
  status: ClassificationStatus;
  transactionType: TransactionType | null;
  category: ExpenseCategory | null;
  confidence: number;
  reasonCode: string;
};

export function classifyExpense(
    input: ClassifyExpenseInput,
  ): ClassifyExpenseResult {
    if (input.confidence < 0 || input.confidence > 1) {
      throw new Error("Confidence must be between 0 and 1");
    }
  
    if (input.actualTransactionType !== input.proposedTransactionType) {
      return {
        status: "review_required",
        transactionType: null,
        category: null,
        confidence: input.confidence,
        reasonCode: "EXPENSE_TYPE_MISMATCH",
      };
    }
  
    if (
      input.actualTransactionType === "cash_deposit" &&
      input.category !== "cash"
    ) {
      return {
        status: "review_required",
        transactionType: null,
        category: null,
        confidence: input.confidence,
        reasonCode: "CASH_DEPOSIT_CATEGORY_MISMATCH",
      };
    }
  
    if (
      input.actualTransactionType === "expense" &&
      input.category === "cash"
    ) {
      return {
        status: "review_required",
        transactionType: null,
        category: null,
        confidence: input.confidence,
        reasonCode: "EXPENSE_CATEGORY_MISMATCH",
      };
    }
  
    if (input.confidence < 0.8) {
      return {
        status: "review_required",
        // Preserve the proposal for human review.
        // This is NOT committed application state.
        transactionType: input.proposedTransactionType,
        category: input.category,
        confidence: input.confidence,
        reasonCode: "EXPENSE_CLASSIFICATION_LOW_CONFIDENCE",
      };
    }
  
    return {
      status: "classified",
      transactionType: input.actualTransactionType,
      category: input.category,
      confidence: input.confidence,
      reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
    };
  }