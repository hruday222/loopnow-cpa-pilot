import { describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(
  mkdtempSync(join(tmpdir(), "cpa-copilot-test-")),
  "test.sqlite",
);

const repository = await import("./repository");

describe("persistent mutation boundary", () => {
  it("seeds receipts into relational persistence", () => {
    const receipts = repository.listReceipts();
    expect(receipts.map((receipt) => receipt.id)).toEqual([
      "rct-001",
      "rct-002",
      "rct-003",
      "rct-004",
      "rct-005",
    ]);
  });

  it("is idempotent across repeated identical mutations", () => {
    const firstRun = repository.createRun({
      receiptId: "rct-001",
      message: "Process this.",
      model: "test",
    });

    const first = repository.applyClassificationMutation({
      receiptId: "rct-001",
      runId: firstRun,
      transactionType: "expense",
      category: "office_expenses",
    });

    const secondRun = repository.createRun({
      receiptId: "rct-001",
      message: "Retry the same mutation.",
      model: "test",
    });

    const second = repository.applyClassificationMutation({
      receiptId: "rct-001",
      runId: secondRun,
      transactionType: "expense",
      category: "office_expenses",
    });

    expect(first.status).toBe("updated");
    expect(second.status).toBe("already_applied");
  });

  it("rejects cross-receipt transaction mutations", () => {
    const runId = repository.createRun({
      receiptId: "rct-001",
      message: "Process this.",
      model: "test",
    });

    expect(() =>
      repository.applyClassificationMutation({
        receiptId: "rct-001",
        runId,
        transactionType: "cash_deposit",
        category: "cash",
      }),
    ).toThrow("transaction type mismatch");
  });

  it("persists and resolves human review", () => {
    const runId = repository.createRun({
      receiptId: "rct-003",
      message: "Process this one.",
      model: "test",
    });

    const approval = repository.createApproval({
      receiptId: "rct-003",
      runId,
      action: "classification_review",
      reason: "Missing GST/HST documentation.",
      proposedAnalysis: { receiptId: "rct-003" },
    });

    expect(
      repository.listPendingApprovals().some(
        (item) => item.id === approval.id,
      ),
    ).toBe(true);

    const resolved = repository.decideApproval({
      approvalId: approval.id,
      decision: "reject",
    });

    expect(resolved.status).toBe("rejected");
  });
});
