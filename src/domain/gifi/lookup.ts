import { gifiCatalogue, type GifiCode } from "./catalogue";
import type { TransactionType } from "@/domain/types";

export type GifiLookupInput = {
  category: string;
  transactionType: TransactionType;
};

export type GifiLookupResult = {
  status: "candidates_found" | "no_candidates";
  candidates: GifiCode[];
  reasonCode: string;
};

function normalizeCategory(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/_/g, " ");
}

export function lookupGifiCandidates(
  input: GifiLookupInput,
): GifiLookupResult {
  const normalizedCategory = normalizeCategory(input.category);

  const candidates = gifiCatalogue.filter((entry) => {
    const categoryMatches =
      normalizeCategory(entry.category) === normalizedCategory;

    const expenseTypeMatches = entry.applicableExpenseTypes.includes(
      input.transactionType,
    );

    return categoryMatches && expenseTypeMatches;
  });

  if (candidates.length === 0) {
    return {
      status: "no_candidates",
      candidates: [],
      reasonCode: "NO_GIFI_CANDIDATES_FOUND",
    };
  }

  return {
    status: "candidates_found",
    candidates,
    reasonCode: "GIFI_CANDIDATES_FOUND",
  };
}