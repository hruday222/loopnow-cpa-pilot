import { CRA_RULESET_VERSION } from "./rules";

export type ComplianceSource = {
  id: string;
  authority: "CRA";
  title: string;
  url: string;
  retrievedAt: string;
  ruleVersion: string;
};

export const complianceSources: ComplianceSource[] = [
  {
    id: "cra-itc-documentation",
    authority: "CRA",
    title: "Documentary Requirements for Claiming Input Tax Credits",
    url: "https://www.canada.ca/en/revenue-agency/services/forms-publications/publications/8-4/documentary-requirements-claiming-input-tax-credits.html",
    retrievedAt: "2026-09-28",
    ruleVersion: CRA_RULESET_VERSION,
  },
  {
    id: "cra-itc",
    authority: "CRA",
    title: "Input tax credits",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit.html",
    retrievedAt: "2026-09-28",
    ruleVersion: CRA_RULESET_VERSION,
  },
  {
    id: "cra-meal-itc",
    authority: "CRA",
    title: "Calculate input tax credits — ITC eligibility percentage",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/calculate-prepare-report/input-tax-credit/calculate-eligibility-percentage.html",
    retrievedAt: "2026-09-28",
    ruleVersion: CRA_RULESET_VERSION,
  },
  {
    id: "cra-gst-hst-registry",
    authority: "CRA",
    title: "Confirming a GST/HST account number",
    url: "https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/confirming-a-gst-hst-account-number.html",
    retrievedAt: "2026-09-28",
    ruleVersion: CRA_RULESET_VERSION,
  },
  {
    id: "cra-gifi",
    authority: "CRA",
    title: "Preparing your financial statements using GIFI",
    url: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    retrievedAt: "2026-09-28",
    ruleVersion: CRA_RULESET_VERSION,
  },
];
