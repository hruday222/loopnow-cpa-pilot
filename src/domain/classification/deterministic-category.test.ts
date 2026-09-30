import {
    describe,
    expect,
    it,
  } from "vitest";
  
  import {
    inferDeterministicExpenseCategory,
  } from "./deterministic-category";
  import {
    getReceiptDetails,
  } from "@/domain/receipt";
  
  describe(
    "inferDeterministicExpenseCategory",
    () => {
      it("identifies office expenses from authoritative receipt facts", () => {
        const receipt =
          getReceiptDetails(
            "rct-001",
          );
  
        expect(
          inferDeterministicExpenseCategory(
            receipt,
          ),
        ).toBe(
          "office_expenses",
        );
      });
  
      it("identifies meals from authoritative receipt facts", () => {
        const receipt =
          getReceiptDetails(
            "rct-002",
          );
  
        expect(
          inferDeterministicExpenseCategory(
            receipt,
          ),
        ).toBe(
          "meals_and_entertainment",
        );
      });
  
      it("returns null when the receipt does not contain enough category evidence", () => {
        const receipt =
          getReceiptDetails(
            "rct-003",
          );
  
        expect(
          inferDeterministicExpenseCategory(
            receipt,
          ),
        ).toBeNull();
      });
  
      it("identifies cash deposits independently of expense text", () => {
        const receipt =
          getReceiptDetails(
            "rct-004",
          );
  
        expect(
          inferDeterministicExpenseCategory(
            receipt,
          ),
        ).toBe("cash");
      });

      it("uses supply description as a deterministic meal signal", () => {
        const receipt = {
          ...getReceiptDetails("rct-003"),
          vendor: "Generic Supplier",
          supplyDescription: "Business lunch catering",
        };
      
        expect(
          inferDeterministicExpenseCategory(receipt),
        ).toBe("meals_and_entertainment");
      });
      
      it("uses vendor text as a deterministic office signal", () => {
        const receipt = {
          ...getReceiptDetails("rct-003"),
          vendor: "Office Supplies Depot",
          supplyDescription: "Generic purchase",
        };
      
        expect(
          inferDeterministicExpenseCategory(receipt),
        ).toBe("office_expenses");
      });
      
      it("returns null when vendor and description contain no recognized signals", () => {
        const receipt = {
          ...getReceiptDetails("rct-003"),
          vendor: "Acme Holdings",
          supplyDescription: "Business purchase",
        };
      
        expect(
          inferDeterministicExpenseCategory(receipt),
        ).toBeNull();
      });
  
      it("fails closed when receipt facts contain conflicting signals", () => {
        const receipt = {
          ...getReceiptDetails(
            "rct-002",
          ),
          vendor:
            "Restaurant Office Supplies",
          supplyDescription:
            "Office supplies and business meal",
        };
  
        expect(
          inferDeterministicExpenseCategory(
            receipt,
          ),
        ).toBeNull();
      });
    },
  );