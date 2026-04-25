import * as SQLite from 'expo-sqlite';
import type { OfflineQueueRepository } from '../domain/OfflineQueueRepository';
import type { PendingOperation, PendingOperationStatus } from '../domain/PendingOperation';

const DB_NAME = 'offline_queue.db';

interface Row {
  id: string;
  type: string;
  negocio_id: string;
  payload_json: string;
  label: string;
  created_at: number;
  attempts: number;
  status: PendingOperationStatus;
  last_error: string | null;
  last_attempt_at: number | null;
}

export class SqliteOfflineQueueRepository implements OfflineQueueRepository {
  private db: SQLite.SQLiteDatabase | null = null;

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync(DB_NAME);
    }
    return this.db;
  }

  async init(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL,
        negocio_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        label TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        last_attempt_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_pending_ops_status ON pending_operations(status);
      CREATE INDEX IF NOT EXISTS idx_pending_ops_created ON pending_operations(created_at);
    `);
  }

  private rowToOperation(r: Row): PendingOperation {
    return {
      id: r.id,
      type: r.type as PendingOperation['type'],
      negocioId: r.negocio_id,
      payload: JSON.parse(r.payload_json),
      label: r.label,
      createdAt: r.created_at,
      attempts: r.attempts,
      status: r.status,
      lastError: r.last_error,
      lastAttemptAt: r.last_attempt_at,
    };
  }

  async enqueue(op: PendingOperation): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `INSERT INTO pending_operations
         (id, type, negocio_id, payload_json, label, created_at, attempts, status, last_error, last_attempt_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      op.id,
      op.type,
      op.negocioId,
      JSON.stringify(op.payload),
      op.label,
      op.createdAt,
      op.attempts,
      op.status,
      op.lastError,
      op.lastAttemptAt,
    );
  }

  async list(): Promise<PendingOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM pending_operations ORDER BY created_at ASC`,
    );
    return rows.map((r) => this.rowToOperation(r));
  }

  async listByStatus(status: PendingOperationStatus): Promise<PendingOperation[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<Row>(
      `SELECT * FROM pending_operations WHERE status = ? ORDER BY created_at ASC`,
      status,
    );
    return rows.map((r) => this.rowToOperation(r));
  }

  async get(id: string): Promise<PendingOperation | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<Row>(
      `SELECT * FROM pending_operations WHERE id = ?`,
      id,
    );
    return row ? this.rowToOperation(row) : null;
  }

  async markSyncing(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE pending_operations SET status = 'syncing', last_attempt_at = ? WHERE id = ?`,
      Date.now(),
      id,
    );
  }

  async markPending(id: string, error?: string): Promise<void> {
    const db = await this.getDb();
    if (error !== undefined) {
      await db.runAsync(
        `UPDATE pending_operations SET status = 'pending', last_error = ?, last_attempt_at = ? WHERE id = ?`,
        error,
        Date.now(),
        id,
      );
    } else {
      await db.runAsync(
        `UPDATE pending_operations SET status = 'pending' WHERE id = ?`,
        id,
      );
    }
  }

  async markFailed(id: string, error: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE pending_operations SET status = 'failed', last_error = ?, last_attempt_at = ? WHERE id = ?`,
      error,
      Date.now(),
      id,
    );
  }

  async remove(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(`DELETE FROM pending_operations WHERE id = ?`, id);
  }

  async incrementAttempts(id: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE pending_operations SET attempts = attempts + 1 WHERE id = ?`,
      id,
    );
  }

  async count(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM pending_operations`,
    );
    return row?.c ?? 0;
  }

  async resetStaleSyncing(): Promise<number> {
    const db = await this.getDb();
    const result = await db.runAsync(
      `UPDATE pending_operations SET status = 'pending' WHERE status = 'syncing'`,
    );
    return result.changes ?? 0;
  }

  async countPending(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ c: number }>(
      `SELECT COUNT(*) as c FROM pending_operations WHERE status != 'syncing'`,
    );
    return row?.c ?? 0;
  }
}
