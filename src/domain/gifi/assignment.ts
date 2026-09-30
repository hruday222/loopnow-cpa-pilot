import { findGifiCode } from "./catalogue";
import type { RuleMetadata } from "@/domain/cra/rules";

const GIFI_SOURCE: RuleMetadata = {
  ruleVersion: "2026.09.1",
  source: "CRA",
};

export type GifiAssignmentStatus =
  | "accepted"
  | "review_required";

import type { TransactionType } from "@/domain/types";

export type AssignGifiCodeInput = {
gifiCode: string;
transactionType: TransactionType;
confidence: number;
};

export type AssignGifiCodeResult = {
  status: GifiAssignmentStatus;
  gifiCode: string | null;
  description: string | null;
  category: string | null;
  reasonCode: string;
  source: RuleMetadata;
};

export function assignGifiCode(
  input: AssignGifiCodeInput,
): AssignGifiCodeResult {
  if (input.confidence < 0 || input.confidence > 1) {
    throw new Error("Confidence must be between 0 and 1.");
  }

  const gifi = findGifiCode(input.gifiCode);

  if (!gifi) {
    return {
      status: "review_required",
      source: GIFI_SOURCE,
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CODE_NOT_IN_CATALOGUE",
    };
  }

  if (!gifi.applicableExpenseTypes.includes(input.transactionType)) {
    return {
      status: "review_required",
      source: GIFI_SOURCE,
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CODE_INCOMPATIBLE_WITH_EXPENSE_TYPE",
    };
  }

  if (input.confidence < 0.8) {
    return {
      status: "review_required",
      source: GIFI_SOURCE,
      gifiCode: null,
      description: null,
      category: null,
      reasonCode: "GIFI_CLASSIFICATION_LOW_CONFIDENCE",
    };
  }

  return {
    status: "accepted",
    source: GIFI_SOURCE,
    gifiCode: gifi.code,
    description: gifi.description,
    category: gifi.category,
    reasonCode: "GIFI_CODE_VALIDATED",
  };
}