import { describe, expect, it } from "vitest";
import {
  lookupGifiCandidates,
} from "./lookup";

describe("lookupGifiCandidates", () => {
  it("finds GIFI 8810 for office expenses", () => {
    const result = lookupGifiCandidates({
      category: "office_expenses",
      transactionType: "expense",
    });

    expect(result.status).toBe("candidates_found");
    expect(result.reasonCode).toBe("GIFI_CANDIDATES_FOUND");
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].code).toBe("8810");
    expect(result.candidates[0].description).toBe("Office expenses");
  });

  it("finds GIFI 8523 for meals and entertainment", () => {
    const result = lookupGifiCandidates({
      category: "meals_and_entertainment",
      transactionType: "expense",
    });

    expect(result.status).toBe("candidates_found");
    expect(result.candidates[0].code).toBe("8523");
  });

  it("finds GIFI 9270 for other expenses", () => {
    const result = lookupGifiCandidates({
      category: "other_expenses",
      transactionType: "expense",
    });

    expect(result.status).toBe("candidates_found");
    expect(result.candidates[0].code).toBe("9270");
  });

  it("finds GIFI 1001 for cash deposits", () => {
    const result = lookupGifiCandidates({
      category: "cash",
      transactionType: "cash_deposit",
    });

    expect(result.status).toBe("candidates_found");
    expect(result.candidates[0].code).toBe("1001");
    expect(result.candidates[0].description).toBe("Cash");
  });

  it("returns no candidates for an unknown category", () => {
    const result = lookupGifiCandidates({
      category: "something_unknown",
      transactionType: "expense",
    });

    expect(result.status).toBe("no_candidates");
    expect(result.reasonCode).toBe("NO_GIFI_CANDIDATES_FOUND");
    expect(result.candidates).toHaveLength(0);
  });

  it("does not return expense GIFI codes for cash deposits", () => {
    const result = lookupGifiCandidates({
      category: "office_expenses",
      transactionType: "cash_deposit",
    });

    expect(result.status).toBe("no_candidates");
    expect(result.candidates).toHaveLength(0);
  });
});