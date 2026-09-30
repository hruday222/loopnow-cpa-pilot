import { stepCountIs, streamText } from "ai";

import { buildProcessingSummary } from "@/agent/build-processing-summary";
import { finalizeRun } from "@/agent/finalize-processing";
import { verifyAnalysis } from "@/agent/verify-processing";
import { hasHumanReviewRequest } from "@/agent/handle-review-request";
import { createAgentTools } from "@/agent/create-agent-tools";
import {
  applyClassificationMutation,
  createApproval,
  createRun,
  finishRun,
  getPersistedReceipt,
  recordAuditEvent,
  setReceiptAnalysis,
  setReceiptStatus,
  upsertToolCall,
} from "@/db/repository";
import { getProcessingSystemPrompt } from "./system-prompt";
import { createAgentModel, getModelName } from "./model";

export type ProcessStreamInput = {
  receiptId: string;
  message: string;
};

const MODEL = getModelName();

function stageForTool(toolName: string) {
  switch (toolName) {
    case "get_current_receipt":
    case "get_receipt_details":
      return "reading" as const;

    case "validate_cra_documentation":
    case "validate_gst_hst_number":
      return "validating" as const;

    case "classify_expense":
      return "categorizing" as const;

    case "calculate_eligible_itc":
      return "calculating" as const;

    case "lookup_gifi_candidates":
    case "assign_gifi_code":
      return "mapping" as const;

    default:
      return null;
  }
}

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function getSafeErrorMessage(context: "tool" | "processing"): string {
  return context === "tool"
    ? "A processing tool could not complete."
    : "Receipt processing could not be completed.";
}

function getErrorMessage(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "message" in value
  ) {
    const message = (value as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "Tool execution failed.";
}

export function createReceiptProcessingStream(
  input: ProcessStreamInput,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const startedAt = Date.now();

      let runId = "";
      let firstTokenAt: number | null = null;

      let finalStatus:
        | "idle"
        | "reading"
        | "validating"
        | "categorizing"
        | "calculating"
        | "mapping"
        | "review"
        | "complete"
        | "error" = "error";

      const emit = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(sse(event, data)),
        );
      };

      try {
        const provider =
  process.env.MODEL_PROVIDER?.trim().toLowerCase() || "gemini";

          const apiKey =
          provider === "groq"
            ? process.env.GROQ_API_KEY
            : provider === "gemini"
              ? process.env.GEMINI_API_KEY
              : process.env.OPENROUTER_API_KEY;

        if (!apiKey) {
          throw new Error(
            `${provider.toUpperCase()} API key is not configured.`,
          );
        }

        const receipt = getPersistedReceipt(
          input.receiptId,
        );

        runId = createRun({
          receiptId: input.receiptId,
          message: input.message,
          model: MODEL,
        });

        setReceiptStatus(
          input.receiptId,
          "reading",
        );

        recordAuditEvent({
          runId,
          receiptId: input.receiptId,
          actor: "system",
          action: "PROCESSING_STARTED",
          input: {
            message: input.message,
          },
          model: MODEL,
          status: "success",
        });

        emit("run", {
          runId,
          receiptId: input.receiptId,
          stage: "reading",
        });

        const model = createAgentModel(apiKey);

        const tools = createAgentTools({
          runId,
          receiptId: input.receiptId,
        });

        const result = streamText({
          model,
          system: getProcessingSystemPrompt(),
          tools,

          stopWhen: stepCountIs(10),

          prepareStep: ({ steps }) => {
            const hasClassification = steps.some(
              (step) =>
                step.toolResults.some(
                  (toolResult) =>
                    toolResult.toolName ===
                    "classify_expense",
                ),
            );

            const hasEligibleItc = steps.some(
              (step) =>
                step.toolResults.some(
                  (toolResult) =>
                    toolResult.toolName ===
                    "calculate_eligible_itc",
                ),
            );

            // The ITC result is a required deterministic
            // checkpoint. Once classification exists,
            // force the model to call the calculator
            // before it can move on to narrative/review
            // steps.
            if (
              hasClassification &&
              !hasEligibleItc
            ) {
              return {
                toolChoice: {
                  type: "tool" as const,
                  toolName:
                    "calculate_eligible_itc" as const,
                },
              };
            }

            return {};
          },

          prompt:
            `Selected receipt ID: ${input.receiptId}\n` +
            `User request: ${input.message}`,
        });

        for await (const event of result.fullStream) {
          const record =
            event as unknown as Record<string, unknown>;

          const type = getString(
            record,
            "type",
          );

          /*
           * -------------------------------------------------
           * MODEL TEXT STREAM
           * -------------------------------------------------
           */
          if (type === "text-delta") {
            const delta =
              getString(record, "textDelta") ??
              getString(record, "text") ??
              "";

            if (delta) {
              firstTokenAt ??= Date.now();

              emit("token", {
                text: delta,
              });
            }

            continue;
          }

          /*
           * -------------------------------------------------
           * TOOL CALL
           * -------------------------------------------------
           *
           * AI SDK exposes tool input as `input`.
           *
           * Do NOT use `record.args`.
           */
          if (type === "tool-call") {
            const toolCallId = getString(
              record,
              "toolCallId",
            );

            const toolName = getString(
              record,
              "toolName",
            );

            if (toolCallId && toolName) {
              const stage =
                stageForTool(toolName);

              if (stage) {
                finalStatus = stage;

                setReceiptStatus(
                  input.receiptId,
                  stage,
                );

                emit("stage", {
                  receiptId:
                    input.receiptId,
                  stage,
                  toolName,
                });
              }

              upsertToolCall({
                id: toolCallId,
                runId,
                receiptId:
                  input.receiptId,
                toolName,
                status: "running",

                // AI SDK v5+
                toolInput: record.input,
              });

              emit("tool", {
                toolCallId,
                toolName,
                status: "running",

                // AI SDK v5+
                input: record.input,
              });
            }

            continue;
          }

          /*
           * -------------------------------------------------
           * TOOL RESULT
           * -------------------------------------------------
           *
           * AI SDK exposes:
           *
           * input  -> original tool input
           * output -> structured tool result
           *
           * Do NOT use:
           * record.args
           * record.result
           * record.isError
           */
          if (type === "tool-result") {
            const toolCallId = getString(
              record,
              "toolCallId",
            );

            if (toolCallId) {
              const toolName =
                getString(
                  record,
                  "toolName",
                ) ?? "unknown";

              upsertToolCall({
                id: toolCallId,
                runId,
                receiptId:
                  input.receiptId,
                toolName,
                status: "completed",

                // AI SDK v5+
                toolInput: record.input,

                // AI SDK v5+
                result: record.output,
              });

              recordAuditEvent({
                runId,
                receiptId:
                  input.receiptId,
                actor: "agent",
                action: "TOOL_EXECUTED",

                // AI SDK v5+
                input: record.input,

                // AI SDK v5+
                result: record.output,

                model: MODEL,
                status: "success",
                metadata: {
                  toolCallId,
                },
              });

              emit("tool", {
                toolCallId,
                toolName,
                status: "completed",

                // AI SDK v5+
                result: record.output,
              });
            }

            continue;
          }

          /*
           * -------------------------------------------------
           * TOOL ERROR
           * -------------------------------------------------
           *
           * Tool execution failures are represented by a
           * separate `tool-error` stream part.
           */
          if (type === "tool-error") {
            const toolCallId = getString(
              record,
              "toolCallId",
            );

            const toolName =
              getString(
                record,
                "toolName",
              ) ?? "unknown";

            const error = getErrorMessage(
              record.error,
            );

            if (toolCallId) {
              upsertToolCall({
                id: toolCallId,
                runId,
                receiptId:
                  input.receiptId,
                toolName,
                status: "failed",

                // Preserve the input that caused
                // the tool failure.
                toolInput: record.input,

                error,
              });

              recordAuditEvent({
                runId,
                receiptId:
                  input.receiptId,
                actor: "agent",
                action: "TOOL_EXECUTED",

                input: record.input,

                result: {
                  error,
                },

                model: MODEL,
                status: "error",
                metadata: {
                  toolCallId,
                },
              });

              emit("tool", {
                toolCallId,
                toolName,
                status: "failed",
                error: getSafeErrorMessage("tool"),
              });
            }

            /*
             * Do not immediately abort the entire model run.
             *
             * The AI SDK/model may be able to recover by
             * retrying or choosing another valid tool call.
             *
             * Final verification remains authoritative.
             */
            continue;
          }

          /*
           * -------------------------------------------------
           * MODEL / PROVIDER ERROR
           * -------------------------------------------------
           */
          if (type === "error") {
            const error =
              getString(
                record,
                "error",
              ) ??
              "The model stream failed.";

            /*
             * Throw so the outer catch performs the
             * complete failure transition:
             *
             * receipt -> error
             * run     -> failed
             * audit   -> PROCESSING_FAILED
             * SSE     -> error
             */
            throw new Error(error);
          }
        }

        /*
         * -------------------------------------------------
         * COLLECT FINAL TOOL RESULTS
         * -------------------------------------------------
         */
        const steps = await result.steps;

        const toolResults =
          steps.flatMap(
            (step) => step.toolResults,
          );

        const usage = await result.usage;

        const usageRecord =
          usage as unknown as Record<
            string,
            unknown
          >;

        const inputTokens = Number(
          usageRecord.inputTokens ??
            usageRecord.promptTokens ??
            0,
        );

        const outputTokens = Number(
          usageRecord.outputTokens ??
            usageRecord.completionTokens ??
            0,
        );

        /*
         * -------------------------------------------------
         * NO TOOLS = FAILURE
         * -------------------------------------------------
         */
        if (toolResults.length === 0) {
          finalStatus = "error";

          setReceiptStatus(
            input.receiptId,
            "error",
          );

          const failureMessage =
            "Agent completed without executing required tools.";

          finishRun({
            runId,
            status: "failed",
            finalStatus,
            startedAt,
            error: failureMessage,
          });

          recordAuditEvent({
            runId,
            receiptId: input.receiptId,
            actor: "system",
            action: "PROCESSING_FAILED",
            result: { error: failureMessage },
            model: MODEL,
            status: "error",
          });

          emit("error", {
            message: getSafeErrorMessage("processing"),
          });

          controller.close();
          return;
        }

        /*
         * -------------------------------------------------
         * DETERMINISTIC FINALIZATION
         * -------------------------------------------------
         */
        const finalization =
          finalizeRun({
            receipt,
            toolResults,
            agentText: await result.text,
          });

        const analysis =
          finalization.analysis;

        let verification =
          finalization.verification;

        recordAuditEvent({
          runId,
          receiptId:
            input.receiptId,
          actor: "system",
          action: "ANALYSIS_VERIFIED",
          result: verification,
          model: MODEL,
          status:
            verification.status ===
            "passed"
              ? "success"
              : "review",
        });

        /*
         * -------------------------------------------------
         * HUMAN REVIEW MUST BLOCK MUTATION
         * -------------------------------------------------
         *
         * Important ordering:
         *
         * 1. Check whether an explicit review request
         *    exists.
         * 2. Only then consider classification mutation.
         */
        const explicitReview =
          hasHumanReviewRequest(
            toolResults,
          );

        if (
          finalization.shouldApplyClassification &&
          !explicitReview &&
          verification.status === "passed"
        ) {
          const classification =
            analysis.classification;

          if (
            classification?.transactionType &&
            classification.category
          ) {
            try {
              applyClassificationMutation({
                receiptId:
                  input.receiptId,
                runId,
                transactionType:
                  classification.transactionType,
                category:
                  classification.category,
              });

              verification =
                verifyAnalysis(
                  receipt,
                  analysis,
                );
            } catch (error) {
              verification = {
                ...verification,

                status: "failed",

                failures: [
                  ...verification.failures,

                  error instanceof Error
                    ? error.message
                    : "Classification mutation failed.",
                ],
              };
            }
          }
        }

        /*
         * -------------------------------------------------
         * HUMAN REVIEW REASON
         * -------------------------------------------------
         */
        const reviewToolResult =
          toolResults.find(
            (toolResult) =>
              toolResult.toolName ===
                "request_human_review" &&
              typeof toolResult.output ===
                "object" &&
              toolResult.output !== null,
          );

        const explicitReviewReason =
          reviewToolResult &&
          typeof (
            reviewToolResult.output as Record<
              string,
              unknown
            >
          ).reason === "string"
            ? String(
                (
                  reviewToolResult.output as Record<
                    string,
                    unknown
                  >
                ).reason,
              )
            : null;

        /*
         * -------------------------------------------------
         * FINAL STATE
         * -------------------------------------------------
         */
        if (
          explicitReview ||
          verification.status !== "passed"
        ) {
          finalStatus = "review";

          setReceiptStatus(
            input.receiptId,
            "review",
          );

          const reason =
            explicitReviewReason ??
            (verification.failures.join(
              " ",
            ) ||
              "Additional review is required before financial state can be finalized.");

          createApproval({
            receiptId:
              input.receiptId,
            runId,
            action:
              "classification_review",
            reason,
            proposedAnalysis:
              analysis,
          });
        } else {
          finalStatus = "complete";

          setReceiptStatus(
            input.receiptId,
            "complete",
          );
        }

        emit("stage", {
          receiptId:
            input.receiptId,
          stage: finalStatus,
        });

        /*
         * Persist deterministic analysis after
         * final verification/state decision.
         */
        setReceiptAnalysis(
          input.receiptId,
          analysis,
          finalStatus,
        );

        /*
         * -------------------------------------------------
         * DETERMINISTIC FINAL SUMMARY
         * -------------------------------------------------
         */
        const finalText =
          buildProcessingSummary(
            receipt,
            analysis,
            verification,
          );

        recordAuditEvent({
          runId,
          receiptId:
            input.receiptId,
          actor: "system",
          action:
            finalStatus === "complete"
              ? "PROCESSING_COMPLETED"
              : "PROCESSING_REVIEW_REQUIRED",
          result: {
            analysis,
            verification,
          },
          model: MODEL,
          status:
            finalStatus === "complete"
              ? "success"
              : "review",
        });

        /*
         * -------------------------------------------------
         * FINISH RUN
         * -------------------------------------------------
         */
        finishRun({
          runId,
          status: "completed",
          finalStatus,
          startedAt,

          ttftMs:
            firstTokenAt === null
              ? undefined
              : firstTokenAt -
                startedAt,

          inputTokens,
          outputTokens,
        });

        /*
         * -------------------------------------------------
         * FINAL SSE EVENT
         * -------------------------------------------------
         */
        emit("final", {
          runId,
          receiptId:
            input.receiptId,
          status: finalStatus,
          analysis,
          verification,
          text: finalText,
        });

        controller.close();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Receipt processing failed.";

        if (runId) {
          try {
            setReceiptStatus(
              input.receiptId,
              "error",
            );

            finishRun({
              runId,
              status: "failed",
              finalStatus: "error",
              startedAt,
              error: message,
            });

            recordAuditEvent({
              runId,
              receiptId:
                input.receiptId,
              actor: "system",
              action:
                "PROCESSING_FAILED",
              result: {
                error: message,
              },
              model: MODEL,
              status: "error",
            });
          } catch {
            /*
             * Preserve the original error for
             * the stream consumer.
             */
          }
        }

        emit("error", {
          message: getSafeErrorMessage("processing"),
        });

        controller.close();
      }
    },
  });
}