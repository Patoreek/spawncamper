import type Database from 'better-sqlite3';
import type { CreateProductInput, Product } from './types';

export class ProductDAL {
  private readonly createStmt: Database.Statement;
  private readonly findByIdStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;

  constructor(db: Database.Database) {
    // Prepare once, reuse forever — much faster than re-preparing per call
    this.createStmt = db.prepare(`
      INSERT INTO products (name, target_price, status)
      VALUES (@name, @target_price, @status)
      RETURNING *
    `);

    this.findByIdStmt = db.prepare(`SELECT * FROM products WHERE id = @id`);
    this.findAllStmt = db.prepare(`SELECT * FROM products`);
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

  findAll(status: string | null): Product[] {
    const queryResults: Product[] = this.findAllStmt.get();
    console.log('QUERY RESULT:', queryResults);
    return queryResults;
  }
}
