import type Database from 'better-sqlite3';
import type { PriceCheckResult, PriceCheck } from './types';
import type { ApiResponse } from '../db/types';

export class PriceCheckDAL {

    private readonly findPreviousPriceStmt: Database.Statement;
    private readonly findAllPreviousPriceStmt: Database.Statement;
    private readonly createStmt: Database.Statement;

    constructor(db: Database.Database) {
        this.createStmt = db.prepare(`
            INSERT INTO price_checks (product_url_id, price, currency, in_stock)
            VALUES (@product_url_id, @price, @currency, @in_stock)
            RETURNING *
        `);
        this.findPreviousPriceStmt = db.prepare(`
            SELECT * FROM price_checks
            WHERE product_url_id = @id
            ORDER BY created_at DESC
            LIMIT 1
        `);
        this.findAllPreviousPriceStmt = db.prepare(`
            SELECT * FROM price_checks
            WHERE product_url_id = @id
            ORDER BY created_at DESC
        `);
    }

    create(input: PriceCheckResult & { product_url_id: number }): PriceCheck {
        return this.createStmt.get({
          product_url_id: input.product_url_id,
          price: input.price,
          currency: input.currency,
          in_stock: input.in_stock ? 1 : 0,
        }) as PriceCheck;
      }

      findPrevious(productUrlId: number): PriceCheck | null {
        return (this.findPreviousPriceStmt.get({ id: productUrlId }) as PriceCheck | undefined) ?? null;
      }

      findAllPrevious(productUrlId: number): PriceCheck[] {
        return this.findAllPreviousPriceStmt.all({ id: productUrlId }) as PriceCheck[];
      }
}