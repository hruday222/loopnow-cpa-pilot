export type GstHstNumberStatus =
  | "valid_format"
  | "invalid_format"
  | "missing"
  | "malformed"
  | "suspicious"
  | "unknown";

export type ValidateGstHstNumberResult = {
  status: GstHstNumberStatus;
  normalizedNumber: string | null;
  reasonCode: string;
};

const GST_HST_ACCOUNT_PATTERN = /^\d{9}RT\d{4}$/;

export function validateGstHstNumberFormat(
  value: string | null | undefined,
): ValidateGstHstNumberResult {
  if (value === null || value === undefined || value.trim() === "") {
    return {
      status: "missing",
      normalizedNumber: null,
      reasonCode: "GST_HST_NUMBER_MISSING",
    };
  }

  const normalizedNumber = value
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  if (normalizedNumber.length !== 15) {
    return {
      status: "malformed",
      normalizedNumber,
      reasonCode: "GST_HST_NUMBER_WRONG_LENGTH",
    };
  }

  if (!GST_HST_ACCOUNT_PATTERN.test(normalizedNumber)) {
    return {
      status: "invalid_format",
      normalizedNumber,
      reasonCode: "GST_HST_NUMBER_INVALID_FORMAT",
    };
  }

  return {
    status: "valid_format",
    normalizedNumber,
    reasonCode: "GST_HST_NUMBER_VALID_FORMAT",
  };
}