import type Database from 'better-sqlite3';
import type { ScrapeFailure, UrlFailureSummary } from './types';

export class ScrapeFailuresDal {
  private readonly insertStmt: Database.Statement;
  private readonly findRecentForUrlStmt: Database.Statement;
  private readonly summaryForUrlStmt: Database.Statement;
  private readonly summariesForProductStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.insertStmt = db.prepare(`
      INSERT INTO price_check_failures (product_url_id, reason, message)
      VALUES (@product_url_id, @reason, @message)
    `);
    this.findRecentForUrlStmt = db.prepare(`
      SELECT * FROM price_check_failures
       WHERE product_url_id = @productUrlId
       ORDER BY created_at DESC
       LIMIT @limit
    `);
    this.summaryForUrlStmt = db.prepare(`
      SELECT
        @productUrlId AS product_url_id,
        (SELECT MAX(created_at) FROM price_check_failures WHERE product_url_id = @productUrlId)
          AS last_failure_at,
        (SELECT COUNT(*) FROM price_check_failures
          WHERE product_url_id = @productUrlId
            AND datetime(created_at) >= datetime('now', '-24 hours'))
          AS failures_last_24h
    `);
    // One row per URL of the product. LEFT JOIN so URLs with no failures still
    // appear (with NULL last_failure_at and 0 count).
    this.summariesForProductStmt = db.prepare(`
      SELECT
        pu.id AS product_url_id,
        MAX(pcf.created_at) AS last_failure_at,
        SUM(CASE WHEN pcf.created_at IS NOT NULL
                  AND datetime(pcf.created_at) >= datetime('now', '-24 hours')
                 THEN 1 ELSE 0 END) AS failures_last_24h
      FROM product_urls pu
      LEFT JOIN price_check_failures pcf ON pcf.product_url_id = pu.id
      WHERE pu.product_id = @productId
      GROUP BY pu.id
    `);
  }

  create(productUrlId: number, reason: string, message: string | null = null): void {
    this.insertStmt.run({ product_url_id: productUrlId, reason, message });
  }

  findRecentForUrl(productUrlId: number, limit: number): ScrapeFailure[] {
    return this.findRecentForUrlStmt.all({ productUrlId, limit }) as ScrapeFailure[];
  }

  summaryForUrl(productUrlId: number): UrlFailureSummary {
    return this.summaryForUrlStmt.get({ productUrlId }) as UrlFailureSummary;
  }

  summariesForProduct(productId: number): UrlFailureSummary[] {
    return this.summariesForProductStmt.all({ productId }) as UrlFailureSummary[];
  }
}
