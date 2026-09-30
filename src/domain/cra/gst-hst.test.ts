import { describe, expect, it } from "vitest";

import { validateGstHstNumberFormat } from "./gst-hst";

describe("validateGstHstNumberFormat", () => {
  it("accepts a valid GST/HST account number format", () => {
    const result = validateGstHstNumberFormat(
      "123456789RT0001",
    );

    expect(result).toEqual({
      status: "valid_format",
      normalizedNumber: "123456789RT0001",
      reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
    });
  });

  it("accepts a formatted number containing spaces", () => {
    const result = validateGstHstNumberFormat(
      "12345 6789 RT 0001",
    );

    expect(result).toEqual({
      status: "valid_format",
      normalizedNumber: "123456789RT0001",
      reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
    });
  });

  it("normalizes lowercase input", () => {
    const result = validateGstHstNumberFormat(
      "123456789rt0001",
    );

    expect(result.status).toBe("valid_format");
    expect(result.normalizedNumber).toBe("123456789RT0001");
  });

  it("detects a missing number", () => {
    const result = validateGstHstNumberFormat(null);

    expect(result).toEqual({
      status: "missing",
      normalizedNumber: null,
      reasonCode: "GST_HST_NUMBER_MISSING",
    });
  });

  it("detects an empty number", () => {
    const result = validateGstHstNumberFormat("   ");

    expect(result.status).toBe("missing");
  });

  it("detects a number with the wrong length", () => {
    const result = validateGstHstNumberFormat(
      "123456789RT001",
    );

    expect(result.status).toBe("malformed");
    expect(result.reasonCode).toBe(
      "GST_HST_NUMBER_WRONG_LENGTH",
    );
  });

  it("rejects an incorrect program identifier", () => {
    const result = validateGstHstNumberFormat(
      "123456789RP0001",
    );

    expect(result.status).toBe("invalid_format");
  });

  it("rejects non-numeric business number characters", () => {
    const result = validateGstHstNumberFormat(
      "12345678ART0001",
    );

    expect(result.status).toBe("invalid_format");
  });

  it("does not classify a format-valid number as suspicious", () => {
    const result = validateGstHstNumberFormat(
      "123456789RT0001",
    );
  
    expect(result.status).toBe("valid_format");
    expect(result.status).not.toBe("suspicious");
  });
  
  it("does not classify a format-valid number as unknown", () => {
    const result = validateGstHstNumberFormat(
      "123456789RT0001",
    );
  
    expect(result.status).toBe("valid_format");
    expect(result.status).not.toBe("unknown");
  });
  
  it("keeps malformed and invalid-format states distinct", () => {
    const malformed = validateGstHstNumberFormat(
      "123456789RT001",
    );
  
    const invalidFormat = validateGstHstNumberFormat(
      "123456789RP0001",
    );
  
    expect(malformed.status).toBe("malformed");
    expect(invalidFormat.status).toBe("invalid_format");
  });

  it("does not claim that a correctly formatted number is actually registered", () => {
    const result = validateGstHstNumberFormat(
      "999999999RT9999",
    );

    expect(result.status).toBe("valid_format");
  });
});