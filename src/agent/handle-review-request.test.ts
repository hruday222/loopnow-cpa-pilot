import { describe, expect, it } from "vitest";

import { hasHumanReviewRequest } from "./handle-review-request";

describe("hasHumanReviewRequest", () => {
  it("detects a review request", () => {
    expect(
      hasHumanReviewRequest([
        {
          toolName: "request_human_review",
          output: {
            receiptId: "rct-003",
            status: "review_requested",
            reason: "Missing GST/HST documentation.",
          },
        },
      ]),
    ).toBe(true);
  });

  it("ignores other tool results", () => {
    expect(
      hasHumanReviewRequest([
        {
          toolName: "calculate_eligible_itc",
          output: {
            eligibleItc: 4.1,
          },
        },
      ]),
    ).toBe(false);
  });

  it("ignores malformed review results", () => {
    expect(
      hasHumanReviewRequest([
        {
          toolName: "request_human_review",
          output: {
            receiptId: "rct-003",
            status: "something_else",
          },
        },
      ]),
    ).toBe(false);
  });
});