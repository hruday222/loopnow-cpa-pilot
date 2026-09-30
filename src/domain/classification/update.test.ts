import { describe, expect, it } from "vitest";
import { updateExpenseClassification } from "./update";

describe("updateExpenseClassification", () => {
  it("returns a valid result for an expense classification", () => {
    const result = updateExpenseClassification({
      receiptId: "rct-001",
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "office_expenses",
    });

    expect(result).toEqual({
      status: "updated",
      receiptId: "rct-001",
      transactionType: "expense",
      category: "office_expenses",
      reasonCode: "CLASSIFICATION_UPDATED",
    });
  });

  it("returns a valid result when applying an existing classification", () => {
    const result = updateExpenseClassification({
      receiptId: "rct-001",
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "office_expenses",
    });

    expect(result).toEqual({
      status: "updated",
      receiptId: "rct-001",
      transactionType: "expense",
      category: "office_expenses",
      reasonCode: "CLASSIFICATION_UPDATED",
    });
  });

  it("routes a transaction type mismatch to review", () => {
    const result = updateExpenseClassification({
      receiptId: "rct-004",
      actualTransactionType: "cash_deposit",
      proposedTransactionType: "expense",
      category: "cash",
    });

    expect(result).toEqual({
      status: "review_required",
      receiptId: "rct-004",
      transactionType: null,
      category: null,
      reasonCode: "EXPENSE_TYPE_MISMATCH",
    });
  });

  it("returns a valid result for a cash classification", () => {
    const result = updateExpenseClassification({
      receiptId: "rct-004",
      actualTransactionType: "cash_deposit",
      proposedTransactionType: "cash_deposit",
      category: "cash",
    });

    expect(result).toEqual({
      status: "updated",
      receiptId: "rct-004",
      transactionType: "cash_deposit",
      category: "cash",
      reasonCode: "CLASSIFICATION_UPDATED",
    });
  });
});