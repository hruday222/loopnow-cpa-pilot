import { createHash, randomUUID } from "node:crypto";
import { classifyExpense, ExpenseCategory } from "@/domain/classification/expense";
import type { ExpenseAnalysis } from "@/domain/analysis";
import { receipts as seedReceipts, type Receipt } from "@/domain/receipt";

import { db, withTransaction } from "./index";

const RULE_VERSION = "2026.09.1";

export type ProcessingStage =
  | "idle"
  | "reading"
  | "validating"
  | "categorizing"
  | "calculating"
  | "mapping"
  | "review"
  | "complete"
  | "error";

export type PersistedReceipt = Receipt & {
  classification: {
    transactionType: Receipt["transactionType"];
    category: string;
  } | null;
  analysis: ExpenseAnalysis | null;
  processingStatus: ProcessingStage;
};

export type Approval = {
  id: string;
  receiptId: string;
  runId: string | null;
  status: "pending" | "approved" | "rejected";
  action: string;
  reason: string;
  proposedAnalysis: ExpenseAnalysis;
  decision: Record<string, unknown> | null;
  createdAt: string;
  decidedAt: string | null;
};

function now(): string {
  return new Date().toISOString();
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== "string") return null;
  return JSON.parse(value) as T;
}

function boolToDb(value: boolean | null): number | null {
  return value === null ? null : value ? 1 : 0;
}

function dbToBool(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return Number(value) === 1;
}

function rowToReceipt(row: Record<string, unknown>): PersistedReceipt {
  return {
    id: String(row.id),
    vendor: String(row.vendor),
    date: row.date === null ? null : String(row.date),
    subtotal: Number(row.subtotal),
    gst: Number(row.gst),
    taxType: String(row.tax_type) as Receipt["taxType"],
    total: Number(row.total),
    receiptAvailable: Number(row.receipt_available) === 1,
    transactionType: String(row.transaction_type) as Receipt["transactionType"],
    gstHstNumber:
      row.gst_hst_number === null ? null : String(row.gst_hst_number),
    commercialUsePercentage: Number(row.commercial_use_percentage),
    recipientName:
      row.recipient_name === null ? null : String(row.recipient_name),
    paymentTerms:
      row.payment_terms === null ? null : String(row.payment_terms),
    supplyDescription:
      row.supply_description === null ? null : String(row.supply_description),
    taxIncluded: dbToBool(row.tax_included),
    taxRate: row.tax_rate === null ? null : Number(row.tax_rate),
    classification: parseJson<PersistedReceipt["classification"]>(
      row.classification_json,
    ),
    analysis: parseJson<ExpenseAnalysis>(row.analysis_json),
    processingStatus: String(row.processing_status) as ProcessingStage,
  };
}

export function initializeDatabase(): void {
  const countRow = db.prepare("SELECT COUNT(*) AS count FROM receipts").get();
  const count = Number(countRow?.count ?? 0);

  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO receipts (
      id, vendor, date, subtotal, gst, tax_type, total, receipt_available,
      transaction_type, gst_hst_number, commercial_use_percentage,
      recipient_name, payment_terms, supply_description, tax_included,
      tax_rate, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  withTransaction(() => {
    for (const receipt of seedReceipts) {
      insert.run(
        receipt.id,
        receipt.vendor,
        receipt.date,
        receipt.subtotal,
        receipt.gst,
        receipt.taxType,
        receipt.total,
        receipt.receiptAvailable ? 1 : 0,
        receipt.transactionType,
        receipt.gstHstNumber,
        receipt.commercialUsePercentage,
        receipt.recipientName,
        receipt.paymentTerms,
        receipt.supplyDescription,
        boolToDb(receipt.taxIncluded),
        receipt.taxRate,
        now(),
      );
    }
  });
}

export function listReceipts(): PersistedReceipt[] {
  initializeDatabase();
  return db
    .prepare("SELECT * FROM receipts ORDER BY id")
    .all()
    .map(rowToReceipt);
}

export function getPersistedReceipt(receiptId: string): PersistedReceipt {
  initializeDatabase();
  const row = db
    .prepare("SELECT * FROM receipts WHERE id = ?")
    .get(receiptId);

  if (!row) throw new Error(`Receipt not found: ${receiptId}`);
  return rowToReceipt(row);
}

export function setReceiptAnalysis(
  receiptId: string,
  analysis: ExpenseAnalysis,
  status: ProcessingStage,
): void {
  db.prepare(`
    UPDATE receipts
    SET analysis_json = ?, processing_status = ?, updated_at = ?
    WHERE id = ?
  `).run(json(analysis), status, now(), receiptId);
}

export function setReceiptStatus(
  receiptId: string,
  status: ProcessingStage,
): void {
  db.prepare(`
    UPDATE receipts
    SET processing_status = ?, updated_at = ?
    WHERE id = ?
  `).run(status, now(), receiptId);
}

export function createRun(input: {
  receiptId: string;
  message: string;
  model: string;
}): string {
  const id = randomUUID();
  db.prepare(`
    INSERT INTO agent_runs (
      id, receipt_id, message, model, status, started_at
    ) VALUES (?, ?, ?, ?, 'running', ?)
  `).run(id, input.receiptId, input.message, input.model, now());

  return id;
}

export function finishRun(input: {
  runId: string;
  status: "completed" | "failed";
  finalStatus: ProcessingStage;
  startedAt: number;
  ttftMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: string;
}): void {
  const completedAt = now();
  db.prepare(`
    UPDATE agent_runs
    SET status = ?, completed_at = ?, duration_ms = ?, ttft_ms = ?,
        input_tokens = ?, output_tokens = ?, final_status = ?, error = ?
    WHERE id = ?
  `).run(
    input.status,
    completedAt,
    Date.now() - input.startedAt,
    input.ttftMs ?? null,
    input.inputTokens ?? null,
    input.outputTokens ?? null,
    input.finalStatus,
    input.error ?? null,
    input.runId,
  );
}

export function upsertToolCall(input: {
  id: string;
  runId: string;
  receiptId: string;
  toolName: string;
  status: "running" | "completed" | "failed";
  toolInput?: unknown;
  result?: unknown;
  error?: string;
}): void {
  const existing = db
    .prepare("SELECT id FROM tool_calls WHERE id = ?")
    .get(input.id);

  if (!existing) {
    db.prepare(`
      INSERT INTO tool_calls (
        id, run_id, receipt_id, tool_name, status,
        input_json, result_json, error, started_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.id,
      input.runId,
      input.receiptId,
      input.toolName,
      input.status,
      input.toolInput === undefined ? null : json(input.toolInput),
      input.result === undefined ? null : json(input.result),
      input.error ?? null,
      now(),
      input.status === "running" ? null : now(),
    );
    return;
  }

  db.prepare(`
    UPDATE tool_calls
    SET status = ?,
        input_json = COALESCE(?, input_json),
        result_json = COALESCE(?, result_json),
        error = ?,
        completed_at = ?
    WHERE id = ?
  `).run(
    input.status,
    input.toolInput === undefined ? null : json(input.toolInput),
    input.result === undefined ? null : json(input.result),
    input.error ?? null,
    input.status === "running" ? null : now(),
    input.id,
  );
}

function hash(value: unknown): string {
  return createHash("sha256").update(json(value)).digest("hex");
}

export function recordAuditEvent(input: {
  runId?: string;
  receiptId?: string;
  actor: "agent" | "system" | "human";
  action: string;
  input?: unknown;
  result?: unknown;
  model?: string;
  status: "success" | "review" | "error";
  metadata?: unknown;
}): void {
  db.prepare(`
    INSERT INTO audit_events (
      id, run_id, receipt_id, timestamp, actor, action,
      input_hash, result_hash, rule_version, model, status, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    input.runId ?? null,
    input.receiptId ?? null,
    now(),
    input.actor,
    input.action,
    input.input === undefined ? null : hash(input.input),
    input.result === undefined ? null : hash(input.result),
    RULE_VERSION,
    input.model ?? null,
    input.status,
    input.metadata === undefined ? null : json(input.metadata),
  );
}

export function applyClassificationMutation(input: {
  receiptId: string;
  runId: string;
  transactionType: Receipt["transactionType"];
  category: string;
}): {
  status: "updated" | "already_applied";
  receiptId: string;
  transactionType: Receipt["transactionType"];
  category: string;
} {
  return withTransaction(() => {
    const receipt = getPersistedReceipt(input.receiptId);

    if (receipt.transactionType !== input.transactionType) {
      throw new Error("Mutation authorization failed: transaction type mismatch.");
    }

    const currentCategory = receipt.classification?.category ?? "none";
    const key =
      `classification:${input.receiptId}:from=${currentCategory}` +
      `:to=${input.transactionType}:${input.category}`;

    const existing = db
      .prepare("SELECT result_json FROM idempotency_keys WHERE key = ?")
      .get(key);

    if (existing) {
      const stored = parseJson<{
        status: "updated" | "already_applied";
        receiptId: string;
        transactionType: Receipt["transactionType"];
        category: string;
      }>(existing.result_json);

      return {
        status: "already_applied" as const,
        receiptId: stored?.receiptId ?? input.receiptId,
        transactionType: stored?.transactionType ?? input.transactionType,
        category: stored?.category ?? input.category,
      };
    }

    if (receipt.classification?.category === input.category) {
      return {
        status: "already_applied" as const,
        receiptId: input.receiptId,
        transactionType: input.transactionType,
        category: input.category,
      };
    }

    const result = {
      status: "updated" as const,
      receiptId: input.receiptId,
      transactionType: input.transactionType,
      category: input.category,
    };

    db.prepare(`
      UPDATE receipts
      SET classification_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      json({
        transactionType: input.transactionType,
        category: input.category,
      }),
      now(),
      input.receiptId,
    );

    db.prepare(`
      INSERT INTO idempotency_keys (
        key, receipt_id, mutation_type, result_json, created_at
      ) VALUES (?, ?, 'classification', ?, ?)
    `).run(key, input.receiptId, json(result), now());

    recordAuditEvent({
      runId: input.runId,
      receiptId: input.receiptId,
      actor: "agent",
      action: "CLASSIFICATION_UPDATED",
      input,
      result,
      status: "success",
    });

    return result;
  });
}

export function createApproval(input: {
  receiptId: string;
  runId: string;
  action: string;
  reason: string;
  proposedAnalysis: ExpenseAnalysis;
}): Approval {
  const existingRow = db
    .prepare(`
      SELECT *
      FROM approvals
      WHERE receipt_id = ? AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `)
    .get(input.receiptId) as Record<string, unknown> | undefined;

  if (existingRow) {
    return {
      id: String(existingRow.id),
      receiptId: String(existingRow.receipt_id),
      runId:
        existingRow.run_id === null ? null : String(existingRow.run_id),
      status: "pending",
      action: String(existingRow.action),
      reason: String(existingRow.reason),
      proposedAnalysis:
        parseJson<ExpenseAnalysis>(existingRow.proposed_analysis_json) ??
        input.proposedAnalysis,
      decision: parseJson<Record<string, unknown>>(
        existingRow.decision_json,
      ),
      createdAt: String(existingRow.created_at),
      decidedAt:
        existingRow.decided_at === null
          ? null
          : String(existingRow.decided_at),
    };
  }

  const id = randomUUID();
  const createdAt = now();

  db.prepare(`
    INSERT INTO approvals (
      id, receipt_id, run_id, status, action, reason,
      proposed_analysis_json, created_at
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
  `).run(
    id,
    input.receiptId,
    input.runId,
    input.action,
    input.reason,
    json(input.proposedAnalysis),
    createdAt,
  );

  recordAuditEvent({
    runId: input.runId,
    receiptId: input.receiptId,
    actor: "agent",
    action: "HUMAN_REVIEW_REQUESTED",
    result: { approvalId: id, reason: input.reason },
    status: "review",
  });

  return {
    id,
    receiptId: input.receiptId,
    runId: input.runId,
    status: "pending",
    action: input.action,
    reason: input.reason,
    proposedAnalysis: input.proposedAnalysis,
    decision: null,
    createdAt,
    decidedAt: null,
  };
}

export function listPendingApprovals(): Approval[] {
  const rows = db
    .prepare("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC")
    .all();

  return rows.map((row) => ({
    id: String(row.id),
    receiptId: String(row.receipt_id),
    runId: row.run_id === null ? null : String(row.run_id),
    status: "pending",
    action: String(row.action),
    reason: String(row.reason),
    proposedAnalysis:
      parseJson<ExpenseAnalysis>(row.proposed_analysis_json) ?? {
        receiptId: String(row.receipt_id),
      },
    decision: parseJson<Record<string, unknown>>(row.decision_json),
    createdAt: String(row.created_at),
    decidedAt: row.decided_at === null ? null : String(row.decided_at),
  }));
}

export function decideApproval(input: {
  approvalId: string;
  decision: "approve" | "reject" | "edit";
  category?: string;
  transactionType?: Receipt["transactionType"];
}): Approval {
  const allowedCategories = new Set([
    "office_expenses",
    "meals_and_entertainment",
    "other_expenses",
    "cash",
  ]);
  if (input.category !== undefined && !allowedCategories.has(input.category)) {
    throw new Error("Invalid bookkeeping category.");
  }
  if (
    input.transactionType !== undefined &&
    input.transactionType !== "expense" &&
    input.transactionType !== "cash_deposit"
  ) {
    throw new Error("Invalid transaction type.");
  }

  return withTransaction(() => {
    const row = db
      .prepare("SELECT * FROM approvals WHERE id = ?")
      .get(input.approvalId);

    if (!row) throw new Error("Approval not found.");
    if (String(row.status) !== "pending") {
      throw new Error("Approval has already been decided.");
    }

    const receiptId = String(row.receipt_id);
    const runId = row.run_id === null ? null : String(row.run_id);
    const proposed =
      parseJson<ExpenseAnalysis>(row.proposed_analysis_json) ?? {
        receiptId,
      };

    if (input.decision === "approve" || input.decision === "edit") {
      const classification = proposed.classification;
      const transactionType =
        input.transactionType ?? classification?.transactionType;
      const category = input.category ?? classification?.category;

      if (!transactionType || !category) {
        throw new Error("Approval cannot be applied without a classification.");
      }

      const receipt = getPersistedReceipt(receiptId);
      if (receipt.transactionType !== transactionType) {
        throw new Error("Approval rejected: transaction type is inconsistent.");
      }

      const validated = classifyExpense({
        actualTransactionType: receipt.transactionType,
        proposedTransactionType: transactionType,
        category: category as
          | "office_expenses"
          | "meals_and_entertainment"
          | "other_expenses"
          | "cash",
        confidence: 1,
      });
      
      if (validated.status !== "classified") {
        throw new Error(
          "Approval rejected: classification is inconsistent with the receipt.",
        );
      }

      const key =
        `human:${input.approvalId}:${input.decision}` +
        `:${transactionType}:${category}`;
      const existing = db
        .prepare("SELECT result_json FROM idempotency_keys WHERE key = ?")
        .get(key);

      if (!existing) {
        db.prepare(`
          UPDATE receipts
          SET classification_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          json({ transactionType, category }),
          now(),
          receiptId,
        );

        db.prepare(`
          INSERT INTO idempotency_keys (
            key, receipt_id, mutation_type, result_json, created_at
          ) VALUES (?, ?, 'human_approval', ?, ?)
        `).run(
          key,
          receiptId,
          json({ transactionType, category }),
          now(),
        );
      }

      /*
       * The original agent analysis may still contain
       * classification.status = "review_required". Once a human
       * approves the proposed classification, persist that decision
       * in the analysis as well so the receipt cannot expose two
       * contradictory classification states.
       *
       * An edit is deliberately kept in review because its ITC/GIFI
       * calculations were generated for the original proposal and
       * must be recomputed before the receipt can become complete.
       */
      const approvedAnalysis: ExpenseAnalysis = {
        receiptId: proposed.receiptId,
        documentation: proposed.documentation,
        gstHst: proposed.gstHst,
        itc: proposed.itc,
        gifi: proposed.gifi,
        classification: {
          status: "classified",
          transactionType,
          category: category as ExpenseCategory,
          confidence: 1,
          reasonCode: "HUMAN_APPROVED",
        },
      };

      const requiresReview =
        input.decision === "edit" ||
        proposed.documentation?.status !== "sufficient" ||
        proposed.itc?.status === "review" ||
        (receipt.transactionType === "expense" &&
          proposed.gstHst?.status !== "valid_format");

      db.prepare(`
        UPDATE receipts
        SET analysis_json = ?, processing_status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        json(approvedAnalysis),
        requiresReview ? "review" : "complete",
        now(),
        receiptId,
      );
    }

    const status =
      input.decision === "reject" ? "rejected" : "approved";
    const decisionJson = {
      decision: input.decision,
      category: input.category ?? null,
      transactionType: input.transactionType ?? null,
    };

    const decidedAt = now();

    db.prepare(`
      UPDATE approvals
      SET status = ?, decision_json = ?, decided_at = ?
      WHERE id = ?
    `).run(status, json(decisionJson), decidedAt, input.approvalId);

    recordAuditEvent({
      runId: runId ?? undefined,
      receiptId,
      actor: "human",
      action:
        input.decision === "reject"
          ? "HUMAN_REVIEW_REJECTED"
          : "HUMAN_REVIEW_APPROVED",
      result: decisionJson,
      status: "success",
    });

    return {
      id: String(row.id),
      receiptId,
      runId,
      status,
      action: String(row.action),
      reason: String(row.reason),
      proposedAnalysis:
        status === "approved" && input.decision !== "reject"
          ? {
              ...proposed,
              classification: {
                status: "classified",
                transactionType:
                  input.transactionType ??
                  proposed.classification?.transactionType ??
                  null,
                category:
                  (input.category ??
                    proposed.classification?.category ??
                    null) as ExpenseCategory | null,
                confidence: 1,
                reasonCode: "HUMAN_APPROVED",
              },
            }
          : proposed,
      decision: decisionJson,
      createdAt: String(row.created_at),
      decidedAt,
    };
  });
}

export function getRunDetails(runId: string): {
  run: Record<string, unknown> | undefined;
  toolCalls: Record<string, unknown>[];
  auditEvents: Record<string, unknown>[];
} {
  return {
    run: db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId),
    toolCalls: db
      .prepare("SELECT * FROM tool_calls WHERE run_id = ? ORDER BY started_at")
      .all(runId),
    auditEvents: db
      .prepare("SELECT * FROM audit_events WHERE run_id = ? ORDER BY timestamp")
      .all(runId),
  };
}

initializeDatabase();
