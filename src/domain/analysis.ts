import type {
    ClassifyExpenseResult,
  } from "@/domain/classification/expense";
  import type {
    DocumentationValidationResult,
  } from "@/domain/cra/documentation";
  import type {
    ValidateGstHstNumberResult,
  } from "@/domain/cra/gst-hst";
  import type {
    CalculateEligibleItcResult,
  } from "@/domain/cra/itc";
  import type {
    AssignGifiCodeResult,
  } from "@/domain/gifi/assignment";
  
  export type ExpenseAnalysis = {
    receiptId: string;
    documentation?: DocumentationValidationResult;
    gstHst?: ValidateGstHstNumberResult;
    classification?: ClassifyExpenseResult;
    itc?: CalculateEligibleItcResult;
    gifi?: AssignGifiCodeResult;
  };