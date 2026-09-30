import { describe, expect, it } from "vitest";

import { agentToolInputSchemas } from "./create-agent-tools";

describe("agent tool input schemas", () => {
  it("rejects unexpected fields for every tool", () => {
    for (const [toolName, schema] of Object.entries(agentToolInputSchemas)) {
      const result = schema.safeParse({ unexpected: "value" });
      expect(result.success, `${toolName} should reject unknown fields`).toBe(false);
    }
  });

  it("rejects non-finite confidence values", () => {
    expect(
      agentToolInputSchemas.classify_expense.safeParse({
        receiptId: "rct-001",
        proposedTransactionType: "expense",
        category: "office_expenses",
        confidence: Infinity,
      }).success,
    ).toBe(false);

    expect(
      agentToolInputSchemas.assign_gifi_code.safeParse({
        receiptId: "rct-001",
        gifiCode: "8810",
        confidence: NaN,
      }).success,
    ).toBe(false);
  });

  it("accepts valid tool inputs", () => {
    expect(
      agentToolInputSchemas.classify_expense.safeParse({
        receiptId: "rct-001",
        proposedTransactionType: "expense",
        category: "office_expenses",
        confidence: 0.95,
      }).success,
    ).toBe(true);
  });

  it("rejects blank or oversized human-review reasons", () => {
    expect(
      agentToolInputSchemas.request_human_review.safeParse({
        receiptId: "rct-001",
        reason: "   ",
      }).success,
    ).toBe(false);

    expect(
      agentToolInputSchemas.request_human_review.safeParse({
        receiptId: "rct-001",
        reason: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
