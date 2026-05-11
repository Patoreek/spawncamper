import type Database from 'better-sqlite3';

export interface FxRateRow {
  currency: string;
  rate: number;
  fetched_at: string;
}

export class FxDal {
  private readonly findAllStmt: Database.Statement;
  private readonly upsertStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.findAllStmt = db.prepare(`SELECT currency, rate, fetched_at FROM fx_rates`);
    this.upsertStmt = db.prepare(`
      INSERT INTO fx_rates (currency, rate, fetched_at)
      VALUES (@currency, @rate, datetime('now'))
      ON CONFLICT(currency) DO UPDATE SET
        rate = excluded.rate,
        fetched_at = datetime('now')
    `);
  }

  findAll(): FxRateRow[] {
    return this.findAllStmt.all() as FxRateRow[];
  }

  upsert(currency: string, rate: number): void {
    this.upsertStmt.run({ currency, rate });
  }
}
