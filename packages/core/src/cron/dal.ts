import type Database from 'better-sqlite3';
import type { CronRun, CronRunSource } from './types';

export class CronRunsDal {
  private readonly insertRunningStmt: Database.Statement;
  private readonly finishSuccessStmt: Database.Statement;
  private readonly finishErrorStmt: Database.Statement;
  private readonly findRunningStmt: Database.Statement;
  private readonly findLatestCompletedStmt: Database.Statement;
  private readonly sweepStaleStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertRunningStmt = db.prepare(`
      INSERT INTO cron_runs (source, status, started_at)
      VALUES (@source, 'running', datetime('now'))
      RETURNING id
    `);
    this.finishSuccessStmt = db.prepare(`
      UPDATE cron_runs
         SET status = 'success',
             completed_at = datetime('now'),
             products_checked = @productsChecked,
             urls_checked = @urlsChecked
       WHERE id = @id
    `);
    this.finishErrorStmt = db.prepare(`
      UPDATE cron_runs
         SET status = 'error',
             completed_at = datetime('now'),
             error = @error
       WHERE id = @id
    `);
    this.findRunningStmt = db.prepare(`
      SELECT * FROM cron_runs
       WHERE status = 'running'
       ORDER BY started_at DESC
       LIMIT 1
    `);
    this.findLatestCompletedStmt = db.prepare(`
      SELECT * FROM cron_runs
       WHERE status != 'running'
       ORDER BY started_at DESC
       LIMIT 1
    `);
    this.sweepStaleStmt = db.prepare(`
      UPDATE cron_runs
         SET status = 'error',
             completed_at = datetime('now'),
             error = COALESCE(error, '') || '[swept stale on boot]'
       WHERE status = 'running'
         AND datetime(started_at) < datetime('now', @cutoff)
    `);
  }

  /**
   * Inserts a new 'running' row. Throws if another running row already exists
   * (unique partial index guarantees only one).
   */
  startRun(source: CronRunSource): number {
    const row = this.insertRunningStmt.get({ source }) as { id: number };
    return row.id;
  }

  finishSuccess(id: number, productsChecked: number, urlsChecked: number): void {
    this.finishSuccessStmt.run({ id, productsChecked, urlsChecked });
  }

  finishError(id: number, error: string): void {
    this.finishErrorStmt.run({ id, error });
  }

  findRunning(): CronRun | null {
    return (this.findRunningStmt.get() as CronRun | undefined) ?? null;
  }

  findLatestCompleted(): CronRun | null {
    return (this.findLatestCompletedStmt.get() as CronRun | undefined) ?? null;
  }

  /**
   * Mark any 'running' row older than `cutoffMinutes` as error. Returns the
   * number of rows swept. Intended to be called on process boot to clean up
   * after crashes.
   */
  sweepStale(cutoffMinutes: number): number {
    const cutoff = `-${cutoffMinutes} minutes`;
    return this.sweepStaleStmt.run({ cutoff }).changes;
  }
}
