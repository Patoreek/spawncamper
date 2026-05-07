import type Database from 'better-sqlite3';
import type { CreateProductInput, Product } from './types';

export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;

export interface SuccessResponse<T = unknown> {
  success: true;
  message?: string;
  data?: T;
  meta?: ResponseMeta;

}

export interface ErrorResponse {
  success: false;
  error: AppError;
  meta?: ResponseMeta;
}

export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  stack?: string;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
}

export class ProductDAL {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findAllByStatusStmt: Database.Statement;
  private readonly pauseProductStmt: Database.Statement;

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
    // activatate
    // archive
    // delete
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
    const result = 0;
    return result;
  };

  archiveProduct(id: number) {
    const result = 0;
    return result;
  };
  
  deleteProduct(id: number) {
    const result = 0;
    return result;
  };
}
