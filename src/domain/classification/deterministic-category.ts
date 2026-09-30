import type { Receipt } from "@/domain/receipt";
import type { ExpenseCategory } from "./expense";

const MEAL_SIGNALS = [
  "restaurant",
  "cafe",
  "café",
  "coffee",
  "meal",
  "meals",
  "food",
  "catering",
  "dining",
  "lunch",
  "dinner",
  "breakfast",
] as const;

const OFFICE_SIGNALS = [
  "office",
  "office supplies",
  "office equipment",
  "stationery",
  "staples",
  "printer",
  "printing",
  "paper",
  "ink",
  "toner",
] as const;

function containsSignal(
  text: string,
  signals: readonly string[],
): boolean {
  return signals.some((signal) =>
    text.includes(signal),
  );
}

/**
 * Derives a conservative category signal from authoritative
 * receipt facts.
 *
 * This is deliberately NOT an LLM classifier.
 *
 * - A positive deterministic signal can constrain the LLM.
 * - An ambiguous or unknown receipt returns null and must not
 *   be auto-approved.
 */
export function inferDeterministicExpenseCategory(
  receipt: Receipt,
): ExpenseCategory | null {
  if (receipt.transactionType === "cash_deposit") {
    return "cash";
  }

  const text = [
    receipt.vendor,
    receipt.supplyDescription ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .trim();

  if (!text) {
    return null;
  }

  const isMeal = containsSignal(
    text,
    MEAL_SIGNALS,
  );

  const isOffice = containsSignal(
    text,
    OFFICE_SIGNALS,
  );

  /*
   * Conflicting signals are ambiguous.
   * Fail closed rather than choosing one.
   */
  if (isMeal && isOffice) {
    return null;
  }

  if (isMeal) {
    return "meals_and_entertainment";
  }

  if (isOffice) {
    return "office_expenses";
  }

  return null;
}