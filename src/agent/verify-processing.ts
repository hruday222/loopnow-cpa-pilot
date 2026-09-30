import type { ExpenseAnalysis } from "../domain/analysis";
import { calculateEligibleItc } from "../domain/cra/itc";
import {
  validateCraDocumentation,
} from "../domain/cra/documentation";
import {
  validateGstHstNumberFormat,
} from "../domain/cra/gst-hst";
import type { Receipt } from "../domain/receipt";
import {
  lookupGifiCandidates,
} from "../domain/gifi/lookup";
import {
  inferDeterministicExpenseCategory,
} from "../domain/classification/deterministic-category";

export type VerificationCheckStatus =
  | "passed"
  | "failed"
  | "not_run"
  | "not_applicable"
  | "review";

export type AnalysisVerificationChecks = {
  receipt: VerificationCheckStatus;
  documentation: VerificationCheckStatus;
  gstHst: VerificationCheckStatus;
  classification: VerificationCheckStatus;
  itc: VerificationCheckStatus;
  gifi: VerificationCheckStatus;
};

export type AnalysisVerificationResult = {
  status:
    | "passed"
    | "incomplete"
    | "failed";
  checks: AnalysisVerificationChecks;
  failures: string[];
};

function roundCurrency(
  value: number,
): number {
  return Math.round(
    (value + Number.EPSILON) *
      100,
  ) / 100;
}

function verifyItc(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
): VerificationCheckStatus {
  /*
   * Cash deposits are not expenses and therefore do not have
   * an eligible ITC.
   */
  if (
    receipt.transactionType ===
    "cash_deposit"
  ) {
    if (!analysis.itc) {
      return "not_applicable";
    }

    if (
      analysis.itc.status ===
        "ineligible" &&
      analysis.itc.reasonCode ===
        "CASH_DEPOSIT_NOT_ELIGIBLE_FOR_ITC" &&
      analysis.itc.eligibleItc === 0
    ) {
      return "passed";
    }

    return "failed";
  }

  if (!analysis.itc) {
    return "not_run";
  }

  if (!analysis.itc.category) {
    return "failed";
  }

  /*
   * The ITC category must agree with the classification.
   */
  if (
    analysis.classification &&
    analysis.classification.category !==
      null &&
    analysis.itc.category !==
      analysis.classification.category
  ) {
    return "failed";
  }

  /*
   * Independently derive the expected category from
   * authoritative receipt facts.
   */
  const deterministicCategory =
    inferDeterministicExpenseCategory(
      receipt,
    );

  /*
   * We cannot safely determine category-specific ITC
   * treatment when the receipt itself is ambiguous.
   */
  if (!deterministicCategory) {
    return "review";
  }

  /*
   * The LLM cannot override the deterministic category.
   */
  if (
    analysis.itc.category !==
    deterministicCategory
  ) {
    return "failed";
  }

  const documentation =
    validateCraDocumentation({
      receiptAvailable:
        receipt.receiptAvailable,
      evidence: {
        supplierName:
          receipt.vendor,
        invoiceDate:
          receipt.date,
        totalAmount:
          receipt.total,
        gstHstNumber:
          receipt.gstHstNumber,
        taxAmount:
          receipt.gst,
        taxIncluded:
          receipt.taxIncluded,
        taxRate:
          receipt.taxRate,
        recipientName:
          receipt.recipientName,
        paymentTerms:
          receipt.paymentTerms,
        supplyDescription:
          receipt.supplyDescription,
      },
    });

  const expected =
    calculateEligibleItc({
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

  const actualEligibleItc =
    roundCurrency(
      analysis.itc.eligibleItc,
    );

  const expectedEligibleItc =
    roundCurrency(
      expected.eligibleItc,
    );

  if (
    actualEligibleItc !==
    expectedEligibleItc
  ) {
    return "failed";
  }

  if (
    analysis.itc.grossTax !==
    expected.grossTax
  ) {
    return "failed";
  }

  if (
    analysis.itc
      .eligibilityPercentage !==
    expected.eligibilityPercentage
  ) {
    return "failed";
  }

  if (
    analysis.itc.status !==
    expected.status
  ) {
    return "failed";
  }

  if (
    analysis.itc.reasonCode !==
    expected.reasonCode
  ) {
    return "failed";
  }

  if (
    analysis.itc.category !==
    expected.category
  ) {
    return "failed";
  }

  if (
    expected.status === "review"
  ) {
    return "review";
  }

  return "passed";
}

function verifyDocumentation(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
): VerificationCheckStatus {
  if (
    receipt.transactionType ===
    "cash_deposit"
  ) {
    return "not_applicable";
  }

  if (!analysis.documentation) {
    return "not_run";
  }

  const expected =
    validateCraDocumentation({
      receiptAvailable:
        receipt.receiptAvailable,
      evidence: {
        supplierName:
          receipt.vendor,
        invoiceDate:
          receipt.date,
        totalAmount:
          receipt.total,
        gstHstNumber:
          receipt.gstHstNumber,
        taxAmount:
          receipt.gst,
        taxIncluded:
          receipt.taxIncluded,
        taxRate:
          receipt.taxRate,
        recipientName:
          receipt.recipientName,
        paymentTerms:
          receipt.paymentTerms,
        supplyDescription:
          receipt.supplyDescription,
      },
    });

  const statusMatches =
    analysis.documentation.status ===
    expected.status;

  const tierMatches =
    analysis.documentation.tier ===
    expected.tier;

  const reasonMatches =
    analysis.documentation
      .reasonCode ===
    expected.reasonCode;

  const missingRequirementsMatch =
    [
      ...analysis.documentation
        .missingRequirements,
    ]
      .sort()
      .join("|") ===
    [
      ...expected
        .missingRequirements,
    ]
      .sort()
      .join("|");

  if (
    statusMatches &&
    tierMatches &&
    reasonMatches &&
    missingRequirementsMatch
  ) {
    return expected.status ===
      "sufficient"
      ? "passed"
      : "review";
  }

  return "failed";
}

function verifyGstHst(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
): VerificationCheckStatus {
  if (
    receipt.transactionType ===
    "cash_deposit"
  ) {
    return "not_applicable";
  }

  if (!analysis.gstHst) {
    return "not_run";
  }

  const expected =
    validateGstHstNumberFormat(
      receipt.gstHstNumber,
    );

  const matches =
    analysis.gstHst.status ===
      expected.status &&
    analysis.gstHst
      .normalizedNumber ===
      expected.normalizedNumber &&
    analysis.gstHst.reasonCode ===
      expected.reasonCode;

  if (!matches) {
    return "failed";
  }

  return expected.status ===
    "valid_format"
    ? "passed"
    : "review";
}

function verifyClassification(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
): VerificationCheckStatus {
  if (!analysis.classification) {
    return "not_run";
  }

  if (
    analysis.classification.status !==
      "classified" ||
    analysis.classification
      .transactionType !==
      receipt.transactionType
  ) {
    return "failed";
  }

  if (
    !analysis.classification.category
  ) {
    return "failed";
  }

  /*
   * Independently validate category against authoritative
   * receipt signals.
   */
  const deterministicCategory =
    inferDeterministicExpenseCategory(
      receipt,
    );

  /*
   * Unknown receipt category is not safe for automatic
   * classification.
   */
  if (!deterministicCategory) {
    return "review";
  }

  /*
   * A model classification that contradicts the receipt
   * facts must never be automatically approved.
   */
  if (
    analysis.classification.category !==
    deterministicCategory
  ) {
    return "failed";
  }

  return "passed";
}

export function verifyAnalysis(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
): AnalysisVerificationResult {
  const failures: string[] = [];
  const reviewReasons: string[] = [];

  const checks: AnalysisVerificationChecks =
    {
      receipt: "passed",
      documentation:
        "not_applicable",
      gstHst: "not_applicable",
      classification:
        "not_run",
      itc: "not_run",
      gifi: "not_run",
    };

  /*
   * Receipt identity must always match.
   */
  if (
    analysis.receiptId !==
    receipt.id
  ) {
    checks.receipt = "failed";

    failures.push(
      "Analysis receipt ID does not match the receipt.",
    );
  }

  /*
   * Documentation and GST/HST are not applicable
   * to cash deposits.
   */
  if (
    receipt.transactionType ===
    "cash_deposit"
  ) {
    checks.documentation =
      "not_applicable";
    checks.gstHst =
      "not_applicable";
  } else {
    checks.documentation =
      verifyDocumentation(
        receipt,
        analysis,
      );

    if (
      checks.documentation ===
      "failed"
    ) {
      failures.push(
        "CRA documentation validation failed.",
      );
    } else if (
      checks.documentation ===
      "review"
    ) {
      reviewReasons.push(
        "CRA documentation requires review.",
      );
    }

    checks.gstHst =
      verifyGstHst(
        receipt,
        analysis,
      );

    if (
      checks.gstHst ===
      "failed"
    ) {
      failures.push(
        "GST/HST validation failed.",
      );
    } else if (
      checks.gstHst ===
      "review"
    ) {
      reviewReasons.push(
        "GST/HST information requires review.",
      );
    }
  }

  /*
   * Classification verification.
   */
  checks.classification =
    verifyClassification(
      receipt,
      analysis,
    );

  if (
    checks.classification ===
    "failed"
  ) {
    failures.push(
      "Classification is invalid or inconsistent.",
    );
  } else if (
    checks.classification ===
    "review"
  ) {
    reviewReasons.push(
      "Expense category cannot be deterministically established from receipt facts.",
    );
  }

  /*
   * ITC verification is independent and deterministic.
   */
  checks.itc = verifyItc(
    receipt,
    analysis,
  );

  if (
    checks.itc === "failed"
  ) {
    failures.push(
      "ITC result failed deterministic verification.",
    );
  } else if (
    checks.itc === "review"
  ) {
    reviewReasons.push(
      "ITC calculation requires review.",
    );
  }

  /*
   * GIFI verification.
   */
  if (!analysis.gifi) {
    checks.gifi = "not_run";
  } else if (
    analysis.gifi.status !==
      "accepted" ||
    analysis.gifi.gifiCode === null
  ) {
    checks.gifi = "failed";

    failures.push(
      "GIFI assignment is invalid or was not accepted.",
    );
  } else if (
    !analysis.classification
  ) {
    checks.gifi = "not_run";
  } else {
    const classificationCategory =
      analysis.classification
        .category;

    if (
      !classificationCategory
    ) {
      checks.gifi = "failed";

      failures.push(
        "GIFI assignment cannot be verified without a classification category.",
      );
    } else {
      const candidates =
        lookupGifiCandidates({
          category:
            classificationCategory,
          transactionType:
            receipt.transactionType,
        });

      const assignedCodeIsValid =
        candidates.candidates.some(
          (candidate) =>
            candidate.code ===
            analysis.gifi
              ?.gifiCode,
        );

      if (
        !assignedCodeIsValid
      ) {
        checks.gifi = "failed";

        failures.push(
          "GIFI code is not valid for the validated classification.",
        );
      } else {
        checks.gifi = "passed";
      }
    }
  }

  const hasTechnicalFailure =
    checks.receipt ===
      "failed" ||
    checks.classification ===
      "failed" ||
    checks.itc === "failed" ||
    checks.gifi === "failed" ||
    checks.documentation ===
      "failed" ||
    checks.gstHst ===
      "failed";

  if (hasTechnicalFailure) {
    return {
      status: "failed",
      checks,
      failures,
    };
  }

  const hasNotRunCheck =
    Object.values(checks).some(
      (status) =>
        status === "not_run",
    );

  if (hasNotRunCheck) {
    return {
      status: "incomplete",
      checks,
      failures: [],
    };
  }

  if (
    reviewReasons.length > 0
  ) {
    return {
      status: "incomplete",
      checks,
      failures:
        reviewReasons,
    };
  }

  return {
    status: "passed",
    checks,
    failures: [],
  };
}