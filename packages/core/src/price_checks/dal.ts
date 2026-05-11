import type Database from 'better-sqlite3';
import type { PriceCheckResult, PriceCheck, LatestPriceCheck } from './types';

export interface PriceHistoryRow {
    id: number;
    product_url_id: number;
    price: number;
    currency: string;
    in_stock: number;
    created_at: string;
    retailer: string;
    url: string;
}

export class PriceCheckDAL {

    private readonly findPreviousPriceStmt: Database.Statement;
    private readonly findAllPreviousPriceStmt: Database.Statement;
    private readonly findLatestForProductStmt: Database.Statement;
    private readonly findFirstForProductStmt: Database.Statement;
    private readonly findHistoryForProductStmt: Database.Statement;
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
        this.findLatestForProductStmt = db.prepare(`
            SELECT pc.*, pu.url, pu.retailer
            FROM price_checks pc
            INNER JOIN product_urls pu ON pc.product_url_id = pu.id
            WHERE pu.product_id = @productId
            AND pc.id = (
              SELECT pc2.id FROM price_checks pc2
              WHERE pc2.product_url_id = pc.product_url_id
              ORDER BY pc2.created_at DESC
              LIMIT 1
            )
            ORDER BY pc.price ASC
        `);
        this.findFirstForProductStmt = db.prepare(`
            SELECT pc.price, pc.currency, pc.created_at, pu.retailer
            FROM price_checks pc
            INNER JOIN product_urls pu ON pc.product_url_id = pu.id
            WHERE pu.product_id = @productId
            ORDER BY pc.created_at ASC
            LIMIT 1
        `);
        this.findHistoryForProductStmt = db.prepare(`
            SELECT pc.id,
                   pc.product_url_id,
                   pc.price,
                   pc.currency,
                   pc.in_stock,
                   pc.created_at,
                   pu.retailer,
                   pu.url
            FROM price_checks pc
            INNER JOIN product_urls pu ON pc.product_url_id = pu.id
            WHERE pu.product_id = @productId
            ORDER BY pc.product_url_id, pc.created_at ASC
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

      findLatestForProduct(productId: number): LatestPriceCheck[] {
        return this.findLatestForProductStmt.all({ productId }) as LatestPriceCheck[];
      }

      findFirstForProduct(productId: number): { price: number; currency: string; created_at: string; retailer: string } | null {
        return (this.findFirstForProductStmt.get({ productId }) as { price: number; currency: string; created_at: string; retailer: string } | undefined) ?? null;
      }

      findHistoryForProduct(productId: number): PriceHistoryRow[] {
        return this.findHistoryForProductStmt.all({ productId }) as PriceHistoryRow[];
      }
}