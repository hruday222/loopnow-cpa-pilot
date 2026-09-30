import type { ExpenseAnalysis } from "@/domain/analysis";
import type { Receipt } from "@/domain/receipt";
import type { AnalysisVerificationResult } from "@/agent/verify-processing";

export function buildProcessingSummary(
  receipt: Receipt,
  analysis: ExpenseAnalysis,
  verification: AnalysisVerificationResult,
): string {
  if (verification.status === "failed") {
    const lines = [
      `Receipt ${receipt.id} requires review.`,
      "",
    ];
  
    if (
      analysis.documentation &&
      analysis.documentation.status !== "sufficient"
    ) {
      lines.push(
        "CRA documentation is insufficient for ITC approval.",
      );
  
      if (analysis.documentation.missingRequirements.length > 0) {
        lines.push(
          `Missing requirements: ${analysis.documentation.missingRequirements.join(", ")}.`,
        );
      }
  
      lines.push(
        "Eligible ITC remains $0.00 until the required documentation is obtained and validated.",
      );
    }
  
    if (
      analysis.gstHst &&
      analysis.gstHst.status === "missing"
    ) {
      lines.push("GST/HST number: missing.");
    }
  
    if (lines.length > 2) {
      return lines.join("\n");
    }
  
    return [
      `Receipt ${receipt.id} requires review.`,
      "",
      ...verification.failures.map(
        (failure) => `- ${failure}`,
      ),
    ].join("\n");
  }

  const classification = analysis.classification;
  const itc = analysis.itc;
  const gifi = analysis.gifi;

  if (verification.status === "incomplete") {
    const requiresReview =
      analysis.documentation?.status !== undefined &&
      analysis.documentation.status !== "sufficient";

    const lines = [
      requiresReview
        ? `Receipt ${receipt.id} requires review.`
        : `Receipt ${receipt.id} analysis is incomplete.`,
      "",
    ];

    if (requiresReview) {
      lines.push(
        "The system completed deterministic processing but cannot safely approve the transaction with the available documentation.",
      );
    
      if (analysis.documentation?.missingRequirements.length) {
        lines.push(
          `Missing requirements: ${analysis.documentation.missingRequirements.join(", ")}.`,
        );
      }
    
      if (analysis.gstHst?.status === "missing") {
        lines.push("GST/HST number: missing.");
      }
    
      lines.push(
        `Eligible ITC: $${analysis.itc?.eligibleItc.toFixed(2) ?? "0.00"}.`,
      );
    
      if (classification) {
        lines.push(
          `Proposed classification: ${classification.category ?? "not classified"}.`,
        );
    
        if (typeof classification.confidence === "number") {
          lines.push(
            `Confidence: ${(classification.confidence * 100).toFixed(0)}%.`,
          );
        }
      }
    
      if (gifi?.gifiCode) {
        lines.push(`GIFI: ${gifi.gifiCode}.`);
      }
    
      lines.push(
        "Human approval is required. The classification has not been applied automatically.",
      );
    
      return lines.join("\n");
    }

    if (classification) {
      lines.push(
        `Transaction type: ${classification.transactionType}`,
        `Category: ${classification.category}`,
      );
    }

    if (gifi) {
      lines.push(`GIFI: ${gifi.gifiCode ?? "not assigned"}`);
    }

    if (itc) {
      lines.push(
        `Eligible ITC: $${itc.eligibleItc.toFixed(2)}`,
      );
    }

    lines.push("");

    const notRunLabels: Record<string, string> = {
      documentation: "CRA documentation validation",
      gstHst: "GST/HST validation",
      classification: "expense classification",
      itc: "ITC calculation",
      gifi: "GIFI assignment",
    };

    const notRun = Object.entries(verification.checks)
      .filter(([, status]) => status === "not_run")
      .map(([check]) => notRunLabels[check])
      .filter(Boolean);

    if (notRun.length > 0) {
      lines.push(
        `Not run: ${notRun.join(", ")}.`,
      );
    }

    if (itc && !classification) {
      lines.push(
        "The ITC calculation is provisional because the expense classification has not been validated.",
      );
    }

    return lines.join("\n");
  }

  return [
    `Receipt ${receipt.id} processed successfully.`,
    "",
    `Transaction type: ${classification?.transactionType ?? receipt.transactionType}`,
    `Category: ${classification?.category ?? "not classified"}`,
    `GIFI: ${gifi?.gifiCode ?? "not assigned"}`,
    `Eligible ITC: $${itc?.eligibleItc?.toFixed(2) ?? "0.00"}`,
    "",
    "All deterministic verification checks passed.",
  ].join("\n");
}