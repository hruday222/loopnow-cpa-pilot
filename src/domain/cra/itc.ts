import {
  CRA_RULESET_VERSION,
  CRA_SOURCES,
  type RuleMetadata,
} from "./rules";

import {
  getMealItcPolicy,
  type MealITCPolicy,
} from "./meals";

const ITC_RULE: RuleMetadata = {
  ruleVersion: CRA_RULESET_VERSION,
  source: "CRA",
  sourceId: "cra-itc",
  url: CRA_SOURCES.itc,
};

export type ItcStatus =
  | "eligible"
  | "partial"
  | "ineligible"
  | "review";

export type CalculateEligibleItcInput = {
  subtotal: number;
  taxAmount: number;
  taxType: "GST" | "HST";
  category: string;
  commercialUsePercentage: number;
  isMeal: boolean;
  mealPolicy?: MealITCPolicy;
  documentationStatus: "sufficient" | "insufficient" | "review";
};

export type CalculateEligibleItcResult = {
  category: string;
  grossTax: number;
  eligibilityPercentage: number;
  eligibleItc: number;
  reasonCode: string;
  status: ItcStatus;
  rule: RuleMetadata;
};

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEligibleItc(
  input: CalculateEligibleItcInput,
): CalculateEligibleItcResult {
  const {
    taxAmount,
    commercialUsePercentage,
    isMeal,
    mealPolicy,
    documentationStatus,
  } = input;

  if (taxAmount < 0) {
    throw new Error("Tax amount cannot be negative.");
  }

  if (
    commercialUsePercentage < 0 ||
    commercialUsePercentage > 100
  ) {
    throw new Error(
      "Commercial use percentage must be between 0 and 100.",
    );
  }

  if (documentationStatus !== "sufficient") {
    return {
      category: input.category,
      grossTax: roundCurrency(taxAmount),
      rule: ITC_RULE,
      eligibilityPercentage: 0,
      eligibleItc: 0,
      reasonCode: "DOCUMENTATION_INCOMPLETE",
      status: "review",
    };
  }

  let eligibilityPercentage = 1;
  let reasonCode = "STANDARD_ITC";

  if (isMeal) {
    const policy = getMealItcPolicy(mealPolicy);

    eligibilityPercentage = policy.eligibilityPercentage;
    reasonCode = policy.reasonCode;
  }

  const eligibleItc = roundCurrency(
    taxAmount *
      eligibilityPercentage *
      (commercialUsePercentage / 100),
  );

  const status =
    eligibleItc === 0
      ? "ineligible"
      : eligibleItc < taxAmount
        ? "partial"
        : "eligible";

  return {
    category: input.category,
    grossTax: roundCurrency(taxAmount),
    rule: ITC_RULE,
    eligibilityPercentage,
    eligibleItc,
    reasonCode,
    status,
  };
}