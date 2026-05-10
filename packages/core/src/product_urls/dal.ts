import type Database from 'better-sqlite3';
import type { CreateProductUrl, ProductUrl } from './types';
import type { ApiResponse } from '../db/types';

export class ProductUrlDAL {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findAllByStatusStmt: Database.Statement;
  private readonly pauseProductStmt: Database.Statement;
  private readonly deleteProductStmt: Database.Statement;

  constructor(db: Database.Database) {
    // Prepare once, reuse forever — much faster than re-preparing per call
    this.createStmt = db.prepare(`
      INSERT INTO product_urls (url, retailer, scrape_config, active)
      VALUES (@url, @retailer, @scrape_config, true)
      RETURNING *
    `);
    this.findByIdStmt = db.prepare(`SELECT * FROM product_urls WHERE id = @id`);
    this.findAllStmt = db.prepare(`SELECT * FROM product_urls ORDER BY id DESC`);
    this.findAllByStatusStmt = db.prepare(`
      SELECT * FROM product_urls
      WHERE status = @status
      ORDER BY id DESC
    `);
    this.pauseProductStmt = db.prepare(`
      UPDATE product_urls
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    this.deleteProductStmt = db.prepare(`
      DELETE FROM product_urls
      WHERE id = @id
    `);
  }

  create(input: CreateProductUrl): ProductUrl {
    return this.createStmt.get({
      url: input.url,
      retailer: input.retailer ?? null,
      scrape_config: input.scrape_config ?? 'default',
    }) as ProductUrl;
  }

  findById(id: number): ProductUrl | null {
    return (this.findByIdStmt.get({ id }) as ProductUrl | undefined) ?? null;
  }

  findAll(status: string | null = null): ProductUrl[] {
    if (status === null) return this.findAllStmt.all() as ProductUrl[];
    return this.findAllByStatusStmt.all({ status }) as ProductUrl[];
  }

  pauseProductUrl(id: number): ApiResponse {
    const result = this.pauseProductStmt.run({ id: Number(id) });
    if (result.changes === 0) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_URL_NOT_FOUND',
          message: `No product found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product ${id} paused`,
      meta: { timestamp: new Date().toISOString() },
    };
  };
  
  deleteProductUrl(id: number) {
    const result = this.deleteProductStmt.run({ id: Number(id)});
    if (result.changes === 0){
      return {
        success: false,
        error: {
          code: 'PRODUCT_URL_NOT_FOUND',
          message: `No product url found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product url ${id} deleted`,
      meta: { timestamp: new Date().toISOString() },
    };
  };


}
