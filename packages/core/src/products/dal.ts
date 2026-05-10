import type Database from 'better-sqlite3';
import type { CreateProductInput, Product } from './types';
import type { ApiResponse } from '../db/types';

export class ProductDAL {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findAllByStatusStmt: Database.Statement;
  private readonly pauseProductStmt: Database.Statement;
  private readonly activateProductStmt: Database.Statement;
  private readonly archiveProductStmt: Database.Statement;
  private readonly deleteProductStmt: Database.Statement;

  constructor(db: Database.Database) {
    // Prepare once, reuse forever — much faster than re-preparing per call
    this.createStmt = db.prepare(`
      INSERT INTO products (name, target_price, status)
      VALUES (@name, @target_price, @status)
      RETURNING *
    `);
    this.findByIdStmt = db.prepare(`SELECT * FROM products WHERE id = @id`);
    this.findAllStmt = db.prepare(`SELECT * FROM products ORDER BY id DESC`);
    this.findAllByStatusStmt = db.prepare(`
      SELECT * FROM products
      WHERE status = @status
      ORDER BY id DESC
    `);
    this.pauseProductStmt = db.prepare(`
      UPDATE products
      SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    this.activateProductStmt = db.prepare(`
      UPDATE products
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    this.archiveProductStmt = db.prepare(`
      UPDATE products
      SET status = 'archived', updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `);
    this.deleteProductStmt = db.prepare(`
      DELETE FROM products
      WHERE id = @id
    `);
  }

  create(input: CreateProductInput): Product {
    return this.createStmt.get({
      name: input.name,
      target_price: input.target_price ?? null,
      status: input.status ?? 'active',
    }) as Product;
  }

  findById(id: number): Product | null {
    return (this.findByIdStmt.get({ id }) as Product | undefined) ?? null;
  }

  findAll(status: string | null = null): Product[] {
    if (status === null) return this.findAllStmt.all() as Product[];
    return this.findAllByStatusStmt.all({ status }) as Product[];
  }

  pauseProduct(id: number): ApiResponse {
    const result = this.pauseProductStmt.run({ id: Number(id) });
    if (result.changes === 0) {
      return {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
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
  
  activateProduct(id: number) {
    const result = this.activateProductStmt.run({ id: Number(id)});
    if (result.changes === 0){
      return {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `No product found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product ${id} activated`,
      meta: { timestamp: new Date().toISOString() },
    };
  };

  archiveProduct(id: number) {
    const result = this.archiveProductStmt.run({ id: Number(id)});
    if (result.changes === 0){
      return {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `No product found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product ${id} archived`,
      meta: { timestamp: new Date().toISOString() },
    };
  };
  
  deleteProduct(id: number) {
    const result = this.deleteProductStmt.run({ id: Number(id)});
    if (result.changes === 0){
      return {
        success: false,
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `No product found with id ${id}`,
        },
        meta: { timestamp: new Date().toISOString() },
      };
    }
    return {
      success: true,
      message: `Product ${id} deleted`,
      meta: { timestamp: new Date().toISOString() },
    };
  };


}
