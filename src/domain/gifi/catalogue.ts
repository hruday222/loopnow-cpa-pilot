export type GifiCode = {
    code: string;
    description: string;
    category: string;
    parentCategory: string;
    applicableExpenseTypes: string[];
    confidence: "high" | "medium" | "low";
    source: string;
    sourceUrl?: string;
  };
  
  export const gifiCatalogue: GifiCode[] = [
    {
      code: "1001",
      description: "Cash",
      category: "Cash",
      parentCategory: "Current Assets",
      applicableExpenseTypes: ["cash_deposit"],
      confidence: "high",
      source: "CRA",
      sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    },
    {
      code: "8810",
      description: "Office expenses",
      category: "Office Expenses",
      parentCategory: "Operating Expenses",
      applicableExpenseTypes: ["expense"],
      confidence: "high",
      source: "CRA",
      sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    },
    {
      code: "8523",
      description: "Meals and entertainment",
      category: "Meals and Entertainment",
      parentCategory: "Operating Expenses",
      applicableExpenseTypes: ["expense"],
      confidence: "high",
      source: "CRA",
      sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    },
    {
      code: "9270",
      description: "Other expenses",
      category: "Other Expenses",
      parentCategory: "Operating Expenses",
      applicableExpenseTypes: ["expense"],
      confidence: "medium",
      source: "CRA",
      sourceUrl: "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/corporations/corporation-income-tax-return/completing-your-corporation-income-tax-t2-return/general-index-financial-information-gifi/preparing-your-financial-statements-using-gifi.html",
    },
  ];
  
  export function findGifiCode(code: string): GifiCode | null {
    return (
      gifiCatalogue.find((item) => item.code === code.trim()) ?? null
    );
  }