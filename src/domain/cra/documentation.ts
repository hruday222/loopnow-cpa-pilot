import {
  CRA_RULESET_VERSION,
  CRA_SOURCES,
  type RuleMetadata,
} from "./rules";

const DOCUMENTATION_THRESHOLDS = {
  under30: 30,
  under150: 150,
} as const;

const DOCUMENTATION_RULE: RuleMetadata = {
  ruleVersion: CRA_RULESET_VERSION,
  source: "CRA",
  sourceId: "cra-itc-documentation",
  url: CRA_SOURCES.documentation,
};

export type DocumentationTier =
  | "under_30"
  | "30_to_under_150"
  | "150_or_more";

  export type DocumentationStatus =
  | "sufficient"
  | "insufficient"
  | "review";

export type DocumentationRequirement =
  | "supplier_name"
  | "invoice_date"
  | "total_amount"
  | "gst_hst_number"
  | "tax_information"
  | "recipient_name"
  | "payment_terms"
  | "supply_description";

export type DocumentationEvidence = {
  supplierName: string | null;
  invoiceDate: string | null;
  totalAmount: number;
  gstHstNumber: string | null;
  taxAmount: number | null;
  taxIncluded: boolean | null;
  taxRate: number | null;
  recipientName: string | null;
  paymentTerms: string | null;
  supplyDescription: string | null;
};

export type DocumentationValidationResult = {
  status: DocumentationStatus;
  tier: DocumentationTier;
  reasonCode: string;
  missingRequirements: DocumentationRequirement[];
  rule: RuleMetadata;
};

export type ValidateDocumentationInput = {
  receiptAvailable: boolean;
  evidence: DocumentationEvidence;
};

function getDocumentationTier(totalAmount: number): DocumentationTier {
  if (totalAmount < DOCUMENTATION_THRESHOLDS.under30) {
    return "under_30";
  }
  
  if (totalAmount < DOCUMENTATION_THRESHOLDS.under150) {
    return "30_to_under_150";
  }

  return "150_or_more";
}

const COMMON_REQUIREMENTS: DocumentationRequirement[] = [
  "supplier_name",
  "invoice_date",
  "total_amount",
];

const MIDDLE_TIER_REQUIREMENTS: DocumentationRequirement[] = [
  ...COMMON_REQUIREMENTS,
  "gst_hst_number",
  "tax_information",
];

const HIGHEST_TIER_REQUIREMENTS: DocumentationRequirement[] = [
  ...MIDDLE_TIER_REQUIREMENTS,
  "recipient_name",
  "payment_terms",
  "supply_description",
];

function getRequiredRequirements(
  tier: DocumentationTier,
): DocumentationRequirement[] {
  switch (tier) {
    case "under_30":
      return COMMON_REQUIREMENTS;

    case "30_to_under_150":
      return MIDDLE_TIER_REQUIREMENTS;

    case "150_or_more":
      return HIGHEST_TIER_REQUIREMENTS;
  }
}

function getMissingRequirements(
  evidence: DocumentationEvidence,
  requirements: DocumentationRequirement[],
): DocumentationRequirement[] {
  return requirements.filter((requirement) => {
    switch (requirement) {
      case "supplier_name":
        return !evidence.supplierName?.trim();

      case "invoice_date":
        return !evidence.invoiceDate;

      case "total_amount":
        return evidence.totalAmount < 0;

      case "gst_hst_number":
        return !evidence.gstHstNumber?.trim();

      case "tax_information":
        return (
          evidence.taxAmount === null &&
          evidence.taxIncluded === null
        );

      case "recipient_name":
        return !evidence.recipientName?.trim();

      case "payment_terms":
        return !evidence.paymentTerms?.trim();

      case "supply_description":
        return !evidence.supplyDescription?.trim();
    }
  });
}

export function validateCraDocumentation(
  input: ValidateDocumentationInput,
): DocumentationValidationResult {
  const { evidence } = input;

  if (!Number.isFinite(evidence.totalAmount)) {
    throw new Error("Total amount must be a finite number.");
  }
  
  if (evidence.totalAmount < 0) {
    throw new Error("Total amount cannot be negative.");
  }

  const tier = getDocumentationTier(evidence.totalAmount);

  if (!input.receiptAvailable) {
    return {
      status: "review",
      rule: DOCUMENTATION_RULE,
      tier,
      reasonCode: "RECEIPT_MISSING",
      missingRequirements: [
        "supplier_name",
        "invoice_date",
        "total_amount",
      ],
    };
  }

  const requiredRequirements = getRequiredRequirements(tier);

  const missingRequirements = getMissingRequirements(
    evidence,
    requiredRequirements,
  );

  if (missingRequirements.length > 0) {
    return {
      status: "insufficient",
      rule: DOCUMENTATION_RULE,
      tier,
      reasonCode: "DOCUMENTATION_REQUIREMENTS_MISSING",
      missingRequirements,
    };
  }

  return {
    status: "sufficient",
    rule: DOCUMENTATION_RULE,
    tier,
    reasonCode: "DOCUMENTATION_SUFFICIENT",
    missingRequirements: [],
  };
}