import type Database from 'better-sqlite3';
import type { CreateProductUrl, ProductUrl } from './types';
import type { ApiResponse } from '../db/types';

/** Row shape from SQLite (`active` stored as 0/1). */
type ProductUrlRow = {
  id: number;
  product_id: number;
  url: string;
  retailer: string;
  scrape_config: string | null;
  active: number;
  created_at: string;
  updated_at: string;
};

function rowToProductUrl(row: ProductUrlRow): ProductUrl {
  return { ...row, active: row.active === 1 };
}

export class ProductUrlDAL {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findByProductIdStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findAllByActiveStmt: Database.Statement;
  private readonly deactivateStmt: Database.Statement;
  private readonly deleteStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.createStmt = db.prepare(`
      INSERT INTO product_urls (product_id, url, retailer, scrape_config, active)
      VALUES (@product_id, @url, @retailer, @scrape_config, @active)
      RETURNING *
    `);
    this.findByIdStmt = db.prepare(`SELECT * FROM product_urls WHERE id = @id`);
    this.findByProductIdStmt = db.prepare(`
      SELECT * FROM product_urls
      WHERE product_id = @product_id
      ORDER BY id DESC
    `);
    this.findAllStmt = db.prepare(`SELECT * FROM product_urls ORDER BY id DESC`);
    this.findAllByActiveStmt = db.prepare(`
      SELECT * FROM product_urls
      WHERE active = @active
      ORDER BY id DESC
    `);
    this.deactivateStmt = db.prepare(`
      UPDATE product_urls
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = @id AND active = 1
    `);
    this.deleteStmt = db.prepare(`
      DELETE FROM product_urls
      WHERE id = @id
    `);
  }

  create(input: CreateProductUrl): ProductUrl {
    const active = (input.active ?? true) ? 1 : 0;
    const row = this.createStmt.get({
      product_id: input.product_id,
      url: input.url,
      retailer: input.retailer,
      scrape_config: input.scrape_config ?? null,
      active,
    }) as ProductUrlRow;
    return rowToProductUrl(row);
  }

  findById(id: number): ProductUrl | null {
    const row = this.findByIdStmt.get({ id }) as ProductUrlRow | undefined;
    return row ? rowToProductUrl(row) : null;
  }

  findByProductId(productId: number): ProductUrl[] {
    const rows = this.findByProductIdStmt.all({
      product_id: productId,
    }) as ProductUrlRow[];
    return rows.map(rowToProductUrl);
  }

  /** Pass `null` for all rows; `true` / `false` filters by `active`. */
  findAll(active: boolean | null = null): ProductUrl[] {
    if (active === null) {
      const rows = this.findAllStmt.all() as ProductUrlRow[];
      return rows.map(rowToProductUrl);
    }
    const rows = this.findAllByActiveStmt.all({
      active: active ? 1 : 0,
    }) as ProductUrlRow[];
    return rows.map(rowToProductUrl);
  }

  /** Sets `active = 0` for this URL (stop watching). */
  pauseProductUrl(id: number): ApiResponse {
    const result = this.deactivateStmt.run({ id: Number(id) });
    if (result.changes === 0) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_URL_NOT_FOUND_OR_INACTIVE',
          message: `No active product URL found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product URL ${id} deactivated`,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  deleteProductUrl(id: number): ApiResponse {
    const result = this.deleteStmt.run({ id: Number(id) });
    if (result.changes === 0) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_URL_NOT_FOUND',
          message: `No product URL found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product URL ${id} deleted`,
      meta: { timestamp: new Date().toISOString() },
    };
  }
}
