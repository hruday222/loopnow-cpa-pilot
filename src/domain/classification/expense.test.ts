import { describe, expect, it } from "vitest";
import { classifyExpense } from "./expense";

describe("classifyExpense", () => {
  it("accepts a high-confidence office expense", () => {
    const result = classifyExpense({
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "office_expenses",
      confidence: 0.94,
    });

    expect(result).toEqual({
      status: "classified",
      transactionType: "expense",
      category: "office_expenses",
      confidence: 0.94,
      reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
    });
  });

  it("accepts a high-confidence business meal", () => {
    const result = classifyExpense({
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "meals_and_entertainment",
      confidence: 0.95,
    });

    expect(result.status).toBe("classified");
    expect(result.category).toBe("meals_and_entertainment");
  });

  it("accepts a high-confidence cash classification", () => {
    const result = classifyExpense({
      actualTransactionType: "cash_deposit",
      proposedTransactionType: "cash_deposit",
      category: "cash",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "classified",
      transactionType: "cash_deposit",
      category: "cash",
      confidence: 0.99,
      reasonCode: "EXPENSE_CLASSIFICATION_VALIDATED",
    });
  });

  it("routes a low-confidence classification to review", () => {
    const result = classifyExpense({
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "office_expenses",
      confidence: 0.6,
    });

    expect(result).toEqual({
      status: "review_required",
      transactionType: "expense",
      category: "office_expenses",
      confidence: 0.6,
      reasonCode: "EXPENSE_CLASSIFICATION_LOW_CONFIDENCE",
    });
  });

  it("routes a cash deposit proposed as an ordinary expense to review", () => {
    const result = classifyExpense({
      actualTransactionType: "cash_deposit",
      proposedTransactionType: "expense",
      category: "office_expenses",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "review_required",
      transactionType: null,
      category: null,
      confidence: 0.99,
      reasonCode: "EXPENSE_TYPE_MISMATCH",
    });
  });

  it("rejects a cash deposit classified with a non-cash category", () => {
    const result = classifyExpense({
      actualTransactionType: "cash_deposit",
      proposedTransactionType: "cash_deposit",
      category: "office_expenses",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "review_required",
      transactionType: null,
      category: null,
      confidence: 0.99,
      reasonCode: "CASH_DEPOSIT_CATEGORY_MISMATCH",
    });
  });

  it("rejects an expense classified as cash", () => {
    const result = classifyExpense({
      actualTransactionType: "expense",
      proposedTransactionType: "expense",
      category: "cash",
      confidence: 0.99,
    });

    expect(result).toEqual({
      status: "review_required",
      transactionType: null,
      category: null,
      confidence: 0.99,
      reasonCode: "EXPENSE_CATEGORY_MISMATCH",
    });
  });

  it("rejects confidence below zero", () => {
    expect(() =>
      classifyExpense({
        actualTransactionType: "expense",
        proposedTransactionType: "expense",
        category: "office_expenses",
        confidence: -0.1,
      }),
    ).toThrow("Confidence must be between 0 and 1");
  });

  it("rejects confidence above one", () => {
    expect(() =>
      classifyExpense({
        actualTransactionType: "expense",
        proposedTransactionType: "expense",
        category: "office_expenses",
        confidence: 1.1,
      }),
    ).toThrow("Confidence must be between 0 and 1");
  });
});