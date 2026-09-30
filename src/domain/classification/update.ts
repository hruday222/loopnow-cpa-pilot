import type { TransactionType } from "@/domain/types";
import type { ExpenseCategory } from "./expense";

export type UpdateExpenseClassificationInput = {
  receiptId: string;
  actualTransactionType: TransactionType;
  proposedTransactionType: TransactionType;
  category: ExpenseCategory;
};

export type UpdateExpenseClassificationResult = {
  status: "updated" | "review_required";
  receiptId: string;
  transactionType: TransactionType | null;
  category: ExpenseCategory | null;
  reasonCode: string;
};

export function updateExpenseClassification(
  input: UpdateExpenseClassificationInput,
): UpdateExpenseClassificationResult {
  if (input.actualTransactionType !== input.proposedTransactionType) {
    return {
      status: "review_required",
      receiptId: input.receiptId,
      transactionType: null,
      category: null,
      reasonCode: "EXPENSE_TYPE_MISMATCH",
    };
  }

  return {
    status: "updated",
    receiptId: input.receiptId,
    transactionType: input.actualTransactionType,
    category: input.category,
    reasonCode: "CLASSIFICATION_UPDATED",
  };
}