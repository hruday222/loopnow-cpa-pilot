import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath =
  process.env.NEXT_PHASE === "phase-production-build"
    ? ":memory:"
    : (process.env.DATABASE_PATH ??
      join(process.cwd(), ".data", "cpa-copilot.sqlite"));

mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    vendor TEXT NOT NULL,
    date TEXT,
    subtotal REAL NOT NULL,
    gst REAL NOT NULL,
    tax_type TEXT NOT NULL DEFAULT 'GST',
    total REAL NOT NULL,
    receipt_available INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    gst_hst_number TEXT,
    commercial_use_percentage REAL NOT NULL,
    recipient_name TEXT,
    payment_terms TEXT,
    supply_description TEXT,
    tax_included INTEGER,
    tax_rate REAL,
    classification_json TEXT,
    analysis_json TEXT,
    processing_status TEXT NOT NULL DEFAULT 'idle',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    message TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    duration_ms INTEGER,
    ttft_ms INTEGER,
    input_tokens INTEGER,
    output_tokens INTEGER,
    final_status TEXT,
    error TEXT
  );

  CREATE TABLE IF NOT EXISTS tool_calls (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES agent_runs(id),
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    tool_name TEXT NOT NULL,
    status TEXT NOT NULL,
    input_json TEXT,
    result_json TEXT,
    error TEXT,
    started_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    receipt_id TEXT REFERENCES receipts(id),
    timestamp TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    input_hash TEXT,
    result_hash TEXT,
    rule_version TEXT,
    model TEXT,
    status TEXT NOT NULL,
    metadata_json TEXT
  );

  CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    run_id TEXT,
    status TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    proposed_analysis_json TEXT NOT NULL,
    decision_json TEXT,
    created_at TEXT NOT NULL,
    decided_at TEXT
  );

  CREATE TABLE IF NOT EXISTS idempotency_keys (
    key TEXT PRIMARY KEY,
    receipt_id TEXT NOT NULL REFERENCES receipts(id),
    mutation_type TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agent_runs_receipt ON agent_runs(receipt_id);
  CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
  CREATE INDEX IF NOT EXISTS idx_audit_events_receipt ON audit_events(receipt_id);
  CREATE INDEX IF NOT EXISTS idx_approvals_receipt ON approvals(receipt_id);
`);

export function withTransaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
