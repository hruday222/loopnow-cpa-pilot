"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";

type Receipt = {
  id: string;
  vendor: string;
  date: string | null;
  subtotal: number;
  gst: number;
  taxType: "GST" | "HST";
  total: number;
  receiptAvailable: boolean;
  transactionType: "expense" | "cash_deposit";
  gstHstNumber: string | null;
  commercialUsePercentage: number;
  recipientName: string | null;
  paymentTerms: string | null;
  supplyDescription: string | null;
  taxIncluded: boolean | null;
  taxRate: number | null;
  classification: {
    transactionType: string;
    category: string;
  } | null;
  analysis: Analysis | null;
  processingStatus: string;
};

type RuleMetadata = {
  ruleVersion: string;
  source: string;
  sourceId?: string;
  url?: string;
};

type Analysis = {
  receiptId: string;

  documentation?: {
    status: string;
    tier: string;
    reasonCode: string;
    missingRequirements: string[];
    rule?: RuleMetadata;
  };

  gstHst?: {
    status: string;
    normalizedNumber: string | null;
    rule?: RuleMetadata;
  };

  classification?: {
    status: string;
    transactionType: string | null;
    category: string | null;
    confidence: number;
  };

  itc?: {
    grossTax: number;
    eligibilityPercentage: number;
    eligibleItc: number;
    status: string;
    reasonCode: string;
    rule?: RuleMetadata;
  };

  gifi?: {
    status: string;
    gifiCode: string | null;
    description: string | null;
    rule?: RuleMetadata;
  };
};

type ToolEvent = {
  toolCallId?: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  result?: unknown;
  error?: string;
};

type Approval = {
  id: string;
  receiptId: string;
  reason: string;
  proposedAnalysis: Analysis;
};

const categoryLabel: Record<string, string> = {
  office_expenses: "Office Expenses",
  meals_and_entertainment: "Meals & Entertainment",
  other_expenses: "Other Expenses",
  cash: "Cash",
};

const stageLabel: Record<string, string> = {
  idle: "Ready",
  reading: "Reading receipt details…",
  validating: "Validating CRA and GST/HST information…",
  categorizing: "Classifying the expense…",
  calculating: "Calculating eligible ITC…",
  mapping: "Mapping the GIFI code…",
  review: "Review required",
  complete: "Complete",
  error: "Processing error",
};

function money(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value);
}

function toolOutcomeLabel(tool: ToolEvent): string {
  if (tool.status === "running") return "RUNNING";
  if (tool.status === "failed") return "FAILED";

  if (tool.result && typeof tool.result === "object") {
    const result = tool.result as Record<string, unknown>;
    const status =
      typeof result.status === "string"
        ? result.status
        : null;

    if (status === "proposal_only") return "PROPOSAL ONLY";
    if (status === "review_requested") return "REVIEW REQUESTED";
    if (status === "review") return "REVIEW REQUIRED";
    if (status === "insufficient") return "INSUFFICIENT";
    if (status === "valid_format") return "VALID FORMAT";
    if (status === "invalid_format") return "INVALID FORMAT";
    if (status === "missing") return "MISSING";
    if (status === "malformed") return "MALFORMED";
    if (status === "suspicious") return "SUSPICIOUS";
    if (status === "unknown") return "UNKNOWN";
    if (status === "review_required") return "REVIEW REQUIRED";
    if (status === "eligible") return "ELIGIBLE";
    if (status === "partial") return "PARTIAL ITC";
    if (status === "ineligible") return "INELIGIBLE";
    if (status === "classified") return "CLASSIFIED";
    if (status === "accepted") return "ACCEPTED";
  }

  return "COMPLETED";
}

export default function Home() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedId, setSelectedId] = useState("rct-003");

  const [message, setMessage] = useState(
    "Process this receipt and tell me if we can claim the GST.",
  );

  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("idle");

  // Model's streamed commentary.
  const [tokens, setTokens] = useState("");

  // Deterministic backend summary emitted by the final SSE event.
  const [finalText, setFinalText] = useState("");

  const [tools, setTools] = useState<ToolEvent[]>([]);
  const [error, setError] = useState("");
  const [approvals, setApprovals] = useState<Approval[]>([]);

  const selected = useMemo(
    () =>
      receipts.find(
        (receipt) => receipt.id === selectedId,
      ) ?? null,
    [receipts, selectedId],
  );

  const loadData = useCallback(async () => {
    const [
      receiptResponse,
      approvalResponse,
    ] = await Promise.all([
      fetch("/api/receipts", {
        cache: "no-store",
      }),
      fetch("/api/approvals", {
        cache: "no-store",
      }),
    ]);

    if (receiptResponse.ok) {
      const data =
        (await receiptResponse.json()) as {
          receipts: Receipt[];
        };

      setReceipts(data.receipts);
    }

    if (approvalResponse.ok) {
      const data =
        (await approvalResponse.json()) as {
          approvals: Approval[];
        };

      setApprovals(data.approvals);
    }
  }, []);

  useEffect(() => {
    // Initial server-state synchronization.
    // This effect intentionally loads data and updates React state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function processSelected() {
    if (!selected) return;

    setRunning(true);
    setError("");
    setTokens("");
    setFinalText("");
    setTools([]);
    setStage("reading");

    try {
      const response = await fetch(
        "/api/process",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receiptId: selected.id,
            message,
          }),
        },
      );

      if (!response.ok || !response.body) {
        throw new Error(
          "Unable to start processing.",
        );
      }

      const reader =
        response.body.getReader();

      const decoder =
        new TextDecoder();

      let buffer = "";

      const consume = (chunk: string) => {
        buffer += chunk;

        const events =
          buffer.split("\n\n");

        buffer =
          events.pop() ?? "";

        for (const raw of events) {
          const dataLine = raw
            .split("\n")
            .find((line) =>
              line.startsWith(
                "data: ",
              ),
            );

          const eventLine = raw
            .split("\n")
            .find((line) =>
              line.startsWith(
                "event: ",
              ),
            );

          if (!dataLine) continue;

          const eventName =
            eventLine?.slice(7) ??
            "message";

          const payload =
            JSON.parse(
              dataLine.slice(6),
            ) as Record<
              string,
              unknown
            >;

          /*
           * -----------------------------------------------
           * PROCESSING STAGE
           * -----------------------------------------------
           */
          if (
            eventName === "stage"
          ) {
            setStage(
              String(
                payload.stage,
              ),
            );
          }

          /*
           * -----------------------------------------------
           * MODEL COMMENTARY
           * -----------------------------------------------
           */
          else if (
            eventName === "token"
          ) {
            setTokens(
              (current) =>
                current +
                String(
                  payload.text ??
                    "",
                ),
            );
          }

          /*
           * -----------------------------------------------
           * TOOL ACTIVITY
           * -----------------------------------------------
           *
           * flushSync is intentional here.
           *
           * The backend can emit:
           *
           * tool: RUNNING
           * tool: COMPLETED
           *
           * in the same browser read cycle.
           *
           * Without flushSync, React can batch both
           * updates and the UI may only show COMPLETED.
           */
          else if (
            eventName === "tool"
          ) {
            flushSync(() => {
              setTools(
                (current) => {
                  const id =
                    String(
                      payload.toolCallId ??
                        payload.toolName,
                    );

                  const next: ToolEvent =
                    {
                      toolCallId: id,
                      toolName:
                        String(
                          payload.toolName,
                        ),
                      status:
                        payload.status as ToolEvent["status"],
                      result:
                        payload.result,
                      error:
                        typeof payload.error ===
                        "string"
                          ? payload.error
                          : undefined,
                    };

                  const existing =
                    current.findIndex(
                      (tool) =>
                        tool.toolCallId ===
                        id,
                    );

                  if (
                    existing === -1
                  ) {
                    return [
                      ...current,
                      next,
                    ];
                  }

                  const copy =
                    [...current];

                  copy[existing] = {
                    ...copy[existing],
                    ...next,
                  };

                  return copy;
                },
              );
            });
          }

          /*
           * -----------------------------------------------
           * DETERMINISTIC FINAL RESULT
           * -----------------------------------------------
           *
           * This is deliberately separate from `tokens`.
           *
           * tokens = model commentary
           * finalText = backend-generated deterministic
           *             processing conclusion
           */
          else if (
            eventName === "final"
          ) {
            setFinalText(
              String(
                payload.text ?? "",
              ),
            );

            if (
              typeof payload.status ===
              "string"
            ) {
              setStage(
                payload.status,
              );
            }
          }

          /*
           * -----------------------------------------------
           * ERROR
           * -----------------------------------------------
           */
          else if (
            eventName === "error"
          ) {
            setStage("error");

            setError(
              String(
                payload.message ??
                  "Processing failed.",
              ),
            );
          }
        }
      };

      while (true) {
        const {
          value,
          done,
        } = await reader.read();

        if (done) break;

        consume(
          decoder.decode(
            value,
            {
              stream: true,
            },
          ),
        );
      }

      await loadData();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Processing failed.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function decideApproval(
    approvalId: string,
    decision:
      | "approve"
      | "reject",
  ) {
    const response =
      await fetch(
        `/api/approvals/${approvalId}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            decision,
          }),
        },
      );

    if (!response.ok) {
      const body =
        (await response.json()) as {
          error?: string;
        };

      setError(
        body.error ??
          "Approval failed.",
      );

      return;
    }

    await loadData();
  }

  const analysis =
    selected?.analysis;

  return (
    <main className="min-h-screen bg-[#09090b] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#0d0d10]">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Loopnow CPA Copilot
            </div>

            <div className="text-xs text-zinc-500">
              Canadian bookkeeping · GST/HST compliance
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-full border border-emerald-900 bg-emerald-950/40 px-3 py-1 text-emerald-400">
              Deterministic rules active
            </span>

            <span className="text-zinc-500">
              CRA ruleset 2026.09.1
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 p-4 lg:grid-cols-[250px_minmax(0,1fr)_390px]">
        <aside className="rounded-xl border border-zinc-800 bg-[#0d0d10]">
          <div className="border-b border-zinc-800 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              Processing queue
            </div>
          </div>

          <div className="p-2">
            {receipts.map(
              (receipt) => (
                <button
                  key={
                    receipt.id
                  }
                  onClick={() => {
                    setSelectedId(
                      receipt.id,
                    );

                    setTokens("");
                    setFinalText("");
                    setTools([]);
                    setError("");
                  }}
                  className={`mb-1 w-full rounded-lg px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    receipt.id === selectedId
                      ? "bg-zinc-800"
                      : "hover:bg-zinc-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Receipt{" "}
                      {receipt.id.replace(
                        "rct-",
                        "#",
                      )}
                    </span>

                    <span
                      className={`h-2 w-2 rounded-full ${
                        receipt.processingStatus ===
                        "complete"
                          ? "bg-emerald-400"
                          : receipt.processingStatus ===
                              "review"
                            ? "bg-amber-400"
                            : receipt.processingStatus ===
                                "error"
                              ? "bg-red-400"
                              : "bg-zinc-600"
                      }`}
                    />
                  </div>

                  <div className="mt-1 truncate text-xs text-zinc-500">
                    {receipt.vendor}
                  </div>

                  <div className="mt-2 text-xs text-zinc-400">
                    {money(
                      receipt.total,
                    )}
                  </div>
                </button>
              ),
            )}
          </div>
        </aside>

        <section className="space-y-4">
          {selected ? (
            <>
              <div className="rounded-xl border border-zinc-800 bg-[#0d0d10] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">
                      Selected receipt
                    </div>

                    <h1 className="mt-1 text-2xl font-semibold">
                      {selected.vendor}
                    </h1>

                    <p className="mt-1 text-sm text-zinc-500">
                      {selected.id} ·{" "}
                      {selected.date ??
                        "Date unavailable"}
                    </p>
                  </div>

                  <span className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400">
                    {selected.transactionType ===
                    "cash_deposit"
                      ? "Cash deposit"
                      : "Expense"}
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    [
                      "Subtotal",
                      money(
                        selected.subtotal,
                      ),
                    ],
                    [
                      selected.taxType,
                      money(
                        selected.gst,
                      ),
                    ],
                    [
                      "Total",
                      money(
                        selected.total,
                      ),
                    ],
                    [
                      "Commercial use",
                      `${selected.commercialUsePercentage}%`,
                    ],
                  ].map(
                    ([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                      >
                        <div className="text-xs text-zinc-500">
                          {label}
                        </div>

                        <div className="mt-1 text-sm font-medium">
                          {value}
                        </div>
                      </div>
                    ),
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div>
                    <span className="text-zinc-500">
                      GST/HST number:
                    </span>{" "}
                    {selected.gstHstNumber ??
                      "Missing"}
                  </div>

                  <div>
                    <span className="text-zinc-500">
                      Documentation:
                    </span>{" "}
                    {selected.receiptAvailable
                      ? "Receipt available"
                      : "Missing"}
                  </div>

                  <div>
                    <span className="text-zinc-500">
                      Description:
                    </span>{" "}
                    {selected.supplyDescription ??
                      "Unavailable"}
                  </div>

                  <div>
                    <span className="text-zinc-500">
                      Classification:
                    </span>{" "}
                    {selected.classification
                      ? categoryLabel[
                          selected
                            .classification
                            .category
                        ] ??
                        selected
                          .classification
                          .category
                      : "Unknown"}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-[#0d0d10] p-5">
                <div>
                  <div className="text-xs uppercase tracking-wider text-zinc-500">
                    Deterministic result
                  </div>

                  <div className="mt-1 text-lg font-semibold">
                    {selected.processingStatus ===
                      "complete" &&
                    analysis?.itc?.status ===
                      "review"
                      ? "Complete — Classification approved"
                      : stageLabel[
                            selected
                              .processingStatus
                          ] ??
                        selected.processingStatus}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <ResultCard
                    label="Documentation"
                    value={
                      analysis?.documentation
                        ?.status ??
                      "Not processed"
                    }
                  />

                  <ResultCard
                    label="GST/HST"
                    value={
                      analysis?.gstHst
                        ?.status ??
                      "Not processed"
                    }
                  />

                  <ResultCard
                    label="Eligible ITC"
                    value={
                      analysis?.itc
                        ? `${money(
                            analysis.itc
                              .eligibleItc,
                          )} — ${analysis.itc.status}`
                        : "Not calculated"
                    }
                  />

                  <ResultCard
                    label="GIFI"
                    value={
                      analysis?.gifi
                        ?.gifiCode
                        ? `${analysis.gifi.gifiCode} — ${
                            analysis.gifi
                              .description ??
                            ""
                          }`
                        : "Not mapped"
                    }
                  />
                </div>

                {analysis?.itc?.rule ? (
                  <div className="mt-4 text-xs text-zinc-500">
                    <span className="font-medium text-zinc-400">
                      Rules:
                    </span>{" "}
                    {analysis.itc.rule.source} · v
                    {analysis.itc.rule.ruleVersion}
                    {analysis.itc.rule.url ? (
                      <>
                        {" · "}
                        <a
                          href={analysis.itc.rule.url}
                          target="_blank"
                          rel="noreferrer"
                          className="underline hover:text-zinc-300"
                        >
                          Source
                        </a>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {analysis?.documentation
                  ?.missingRequirements
                  .length ? (
                  <div className="mt-4 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4">
                    <div className="text-sm font-medium text-amber-300">
                      Review required
                    </div>

                    <div className="mt-1 text-xs leading-5 text-amber-200/70">
                      Missing:{" "}
                      {analysis.documentation.missingRequirements.join(
                        ", ",
                      )}
                      . The system will not approve the ITC automatically.
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-[#0d0d10] p-8">
              No receipt selected.
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <section className="rounded-xl border border-zinc-800 bg-[#0d0d10]">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Agent
              </div>
            </div>

            <div className="p-4">
              <div className="rounded-lg border border-zinc-800 bg-black/20 p-3">
                <div className="text-xs text-zinc-500">
                  Current stage
                </div>

                <div className="mt-1 text-sm font-medium" aria-live="polite" aria-atomic="true">
                  {stageLabel[
                    stage
                  ] ??
                    stageLabel[
                      selected?.processingStatus ??
                        "idle"
                    ]}
                </div>
              </div>
              
              <label
                htmlFor="agent-message"
                className="sr-only"
              >
                Message the CPA assistant
              </label>

              <textarea
                id="agent-message"
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                className="mt-3 min-h-24 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
                disabled={running}
              />

              <button
                onClick={() =>
                  void processSelected()
                }
                disabled={
                  running ||
                  !selected
                }
                className="mt-3 w-full rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d10] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {running
                  ? "Processing…"
                  : "Process selected receipt"}
              </button>

              {error && (
                <div className="mt-3 rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300" role="alert" aria-live="assertive">
                  {error}
                </div>
              )}

              {tokens && (
                <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="mb-2 text-xs text-zinc-500">
                    Streamed explanation
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                    {tokens}
                  </div>
                </div>
              )}

              {finalText && (
                <div className="mt-4 rounded-lg border border-emerald-900/50 bg-emerald-950/10 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs font-medium uppercase tracking-wider text-emerald-400">
                      Verified result
                    </div>

                    <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                      Backend verified
                    </div>
                  </div>

                  <div className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">
                    {finalText}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-[#0d0d10]">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Tool activity
              </div>
            </div>

            <div className="p-3">
              {tools.length === 0 ? (
                <div className="px-2 py-3 text-xs text-zinc-600">
                  No tool calls in this run.
                </div>
              ) : (
                tools.map(
                  (tool) => (
                    <div
                      key={
                        tool.toolCallId
                      }
                      className="flex items-center gap-2 border-b border-zinc-900 px-2 py-2.5 last:border-0"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          tool.status ===
                          "completed"
                            ? "bg-emerald-400"
                            : tool.status ===
                                "failed"
                              ? "bg-red-400"
                              : "bg-amber-400"
                        }`}
                      />

                      <span className="flex-1 text-xs text-zinc-400">
                        {tool.toolName}
                      </span>

                      <span className="text-[10px] uppercase text-zinc-600">
                        {toolOutcomeLabel(
                          tool,
                        )}
                      </span>
                    </div>
                  ),
                )
              )}
            </div>
          </section>

          {approvals.filter(
            (approval) =>
              approval.receiptId ===
              selectedId,
          ).length > 0 && (
            <section className="rounded-xl border border-amber-900/50 bg-amber-950/10">
              <div className="border-b border-amber-900/30 px-4 py-3">
                <div className="text-xs font-medium uppercase tracking-wider text-amber-400">
                  Human review
                </div>
              </div>

              {approvals
                .filter(
                  (approval) =>
                    approval.receiptId ===
                    selectedId,
                )
                .map(
                  (approval) => (
                    <div
                      key={approval.id}
                      className="p-4"
                    >
                      <div className="text-sm text-zinc-300">
                        {approval.reason}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() =>
                            void decideApproval(
                              approval.id,
                              "approve",
                            )
                          }
                          className="rounded-md bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() =>
                            void decideApproval(
                              approval.id,
                              "reject",
                            )
                          }
                          className="rounded-md bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ),
                )}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

function ResultCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 p-3">
      <div className="text-xs text-zinc-500">
        {label}
      </div>

      <div className="mt-1 truncate text-sm font-medium capitalize">
        {value.replaceAll(
          "_",
          " ",
        )}
      </div>
    </div>
  );
}