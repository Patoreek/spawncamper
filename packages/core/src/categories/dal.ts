import type Database from 'better-sqlite3';
import type { Category } from './types';

export class CategoryDAL {
  private readonly createStmt: Database.Statement;
  private readonly findAllStmt: Database.Statement;
  private readonly findByNameStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.createStmt = db.prepare(`
      INSERT INTO categories (name) VALUES (@name)
      RETURNING *
    `);
    this.findAllStmt = db.prepare(`SELECT * FROM categories ORDER BY name ASC`);
    this.findByNameStmt = db.prepare(`SELECT * FROM categories WHERE name = @name`);
  }

  create(name: string): Category {
    return this.createStmt.get({ name }) as Category;
  }

  findAll(): Category[] {
    return this.findAllStmt.all() as Category[];
  }

  findByName(name: string): Category | null {
    return (this.findByNameStmt.get({ name }) as Category | undefined) ?? null;
  }
}
