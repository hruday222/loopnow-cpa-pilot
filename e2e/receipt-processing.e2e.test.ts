import { describe, expect, it } from "vitest";

const runE2E = process.env.RUN_E2E === "1";

describe.skipIf(!runE2E)("Receipt processing E2E", () => {
  it(
    "processes Receipt #002 from HTTP request through agent, tools, persistence, and SSE",
    async () => {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is required for the E2E test.");
      }

      process.env.DATABASE_PATH = ".data/e2e-cpa-copilot.sqlite";

      const { POST } = await import("../src/app/api/process/route");

      const {
        getPersistedReceipt,
        getRunDetails,
      } = await import("../src/db/repository");

      const response = await POST(
        new Request("http://localhost/api/process", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": `e2e-${Date.now()}`,
          },
          body: JSON.stringify({
            receiptId: "rct-002",
            message:
              "Process this receipt and tell me if we can claim the GST.",
          }),
        }),
      );

      expect(response.ok).toBe(true);

      expect(response.headers.get("content-type")).toContain(
        "text/event-stream",
      );

      const body = await response.text();

      const events = body
        .split("\n\n")
        .filter(Boolean)
        .map((block) => {
          const eventLine = block
            .split("\n")
            .find((line) => line.startsWith("event: "));

          const dataLine = block
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!eventLine || !dataLine) {
            return null;
          }

          return {
            event: eventLine.slice("event: ".length),
            data: JSON.parse(dataLine.slice("data: ".length)),
          };
        })
        .filter(
          (
            event,
          ): event is {
            event: string;
            data: Record<string, unknown>;
          } => event !== null,
        );

      /*
       * -------------------------------------------------
       * SSE FINAL RESULT
       * -------------------------------------------------
       */

      const finalEvent = events.find(
        (event) => event.event === "final",
      );

      expect(finalEvent).toBeDefined();

      const finalData = finalEvent!.data;

      expect(finalData.receiptId).toBe("rct-002");
      expect(finalData.status).toBe("complete");
      expect(typeof finalData.runId).toBe("string");

      const analysis = finalData.analysis as {
        classification?: {
          status?: string;
          transactionType?: string | null;
          category?: string | null;
          confidence?: number;
        };
        itc?: {
          status?: string;
          grossTax?: number;
          eligibilityPercentage?: number;
          eligibleItc?: number;
        };
        gifi?: {
          status?: string;
          gifiCode?: string | null;
        };
        documentation?: {
          status?: string;
        };
        gstHst?: {
          status?: string;
        };
      };

      expect(analysis.classification?.status).toBe("classified");
      expect(analysis.classification?.transactionType).toBe(
        "expense",
      );
      expect(analysis.classification?.category).toBe(
        "meals_and_entertainment",
      );

      expect(analysis.itc?.grossTax).toBe(12);
      expect(analysis.itc?.eligibilityPercentage).toBe(0.5);
      expect(analysis.itc?.eligibleItc).toBe(6);

      expect(analysis.gifi?.status).toBe("accepted");
      expect(analysis.gifi?.gifiCode).toBe("8523");

      expect(analysis.documentation?.status).toBe("sufficient");
      expect(analysis.gstHst?.status).toBe("valid_format");

      /*
       * -------------------------------------------------
       * SSE TOOL ACTIVITY
       * -------------------------------------------------
       */

      const toolEvents = events.filter(
        (event) => event.event === "tool",
      );

      expect(toolEvents.length).toBeGreaterThan(0);

      const completedTools = toolEvents
        .filter(
          (event) => event.data.status === "completed",
        )
        .map(
          (event) =>
            event.data.toolName,
        );

      expect(completedTools).toContain(
        "get_current_receipt",
      );

      expect(completedTools).toContain(
        "validate_cra_documentation",
      );

      expect(completedTools).toContain(
        "validate_gst_hst_number",
      );

      expect(completedTools).toContain(
        "classify_expense",
      );

      expect(completedTools).toContain(
        "calculate_eligible_itc",
      );

      expect(completedTools).toContain(
        "assign_gifi_code",
      );

      /*
       * -------------------------------------------------
       * PERSISTED RECEIPT STATE
       * -------------------------------------------------
       */

      const receipt = getPersistedReceipt("rct-002");

      expect(receipt.id).toBe("rct-002");
      expect(receipt.processingStatus).toBe("complete");

      expect(receipt.classification).toEqual({
        transactionType: "expense",
        category: "meals_and_entertainment",
      });

      expect(receipt.analysis?.itc?.eligibleItc).toBe(6);
      expect(receipt.analysis?.itc?.eligibilityPercentage).toBe(
        0.5,
      );

      expect(receipt.analysis?.gifi?.gifiCode).toBe(
        "8523",
      );

      /*
       * -------------------------------------------------
       * RUN + TOOL PERSISTENCE + AUDIT
       * -------------------------------------------------
       */

      const runId = String(finalData.runId);

      const runDetails = getRunDetails(runId);

      expect(runDetails.run).toBeDefined();

      expect(runDetails.toolCalls.length).toBeGreaterThan(
        0,
      );

      expect(runDetails.auditEvents.length).toBeGreaterThan(
        0,
      );

      const persistedToolNames =
        runDetails.toolCalls.map(
          (toolCall) =>
            String(toolCall.tool_name),
        );

      expect(persistedToolNames).toContain(
        "get_current_receipt",
      );

      expect(persistedToolNames).toContain(
        "validate_cra_documentation",
      );

      expect(persistedToolNames).toContain(
        "calculate_eligible_itc",
      );

      expect(persistedToolNames).toContain(
        "classify_expense",
      );

      expect(persistedToolNames).toContain(
        "assign_gifi_code",
      );

      /*
       * -------------------------------------------------
       * AUDIT TRAIL
       * -------------------------------------------------
       */

      const auditActions =
        runDetails.auditEvents.map(
          (event) =>
            String(event.action),
        );

      expect(auditActions).toContain(
        "PROCESSING_STARTED",
      );

      expect(auditActions).toContain(
        "TOOL_EXECUTED",
      );

      expect(auditActions).toContain(
        "PROCESSING_COMPLETED",
      );
    },
    120_000,
  );
});