
export type MealITCPolicy =
  | "standard"
  | "charity_or_public_institution"
  | "long_haul_truck_driver";

export type MealITCPolicyResult = {
  policy: MealITCPolicy;
  eligibilityPercentage: number;
  reasonCode: string;
};

const MEAL_ITC_PERCENTAGES: Record<MealITCPolicy, number> = {
  standard: 0.5,
  charity_or_public_institution: 1,
  long_haul_truck_driver: 0.8,
};

const MEAL_ITC_REASON_CODES: Record<MealITCPolicy, string> = {
  standard: "BUSINESS_MEAL_50_PERCENT",
  charity_or_public_institution: "MEAL_CHARITY_PUBLIC_INSTITUTION_100_PERCENT",
  long_haul_truck_driver: "MEAL_LONG_HAUL_TRUCK_DRIVER_80_PERCENT",
};

export function getMealItcPolicy(
  policy: MealITCPolicy = "standard",
): MealITCPolicyResult {
  return {
    policy,
    eligibilityPercentage: MEAL_ITC_PERCENTAGES[policy],
    reasonCode: MEAL_ITC_REASON_CODES[policy],
  };
}