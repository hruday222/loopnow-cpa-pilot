import { describe, expect, it } from "vitest";
import { getMealItcPolicy } from "./meals";

describe("getMealItcPolicy", () => {
  it("uses the standard 50% meal ITC policy", () => {
    const result = getMealItcPolicy("standard");

    expect(result).toEqual({
      policy: "standard",
      eligibilityPercentage: 0.5,
      reasonCode: "BUSINESS_MEAL_50_PERCENT",
    });
  });

  it("supports the 100% charity/public institution exception", () => {
    const result = getMealItcPolicy("charity_or_public_institution");

    expect(result).toEqual({
      policy: "charity_or_public_institution",
      eligibilityPercentage: 1,
      reasonCode: "MEAL_CHARITY_PUBLIC_INSTITUTION_100_PERCENT",
    });
  });

  it("supports the 80% long-haul truck driver exception", () => {
    const result = getMealItcPolicy("long_haul_truck_driver");

    expect(result).toEqual({
      policy: "long_haul_truck_driver",
      eligibilityPercentage: 0.8,
      reasonCode: "MEAL_LONG_HAUL_TRUCK_DRIVER_80_PERCENT",
    });
  });

  it("defaults to the standard policy", () => {
    const result = getMealItcPolicy();

    expect(result.eligibilityPercentage).toBe(0.5);
  });
});