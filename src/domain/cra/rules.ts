export const CRA_RULESET_VERSION = "2026.09.1";

export type RuleMetadata = {
  ruleVersion: string;
  source: string;
  sourceId?: string;
  url?: string;
};

export const CRA_SOURCES = {
  documentation:
    "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/8-4/documentary-requirements-claiming-input-tax-credits.html",
  itc:
    "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
  meals:
    "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit/calculate-eligibility-percentage.html",
  gifi:
    "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
} as const;
