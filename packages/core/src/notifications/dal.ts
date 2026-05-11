import type Database from 'better-sqlite3';
import type {
  CreateNotificationInput,
  NotificationRecord,
} from './types';

export class NotificationDAL {
  private readonly createStmt: Database.Statement;
  private readonly findLatestStmt: Database.Statement;
  private readonly clearForProductStmt: Database.Statement;

  constructor(db: Database.Database) {
    this.createStmt = db.prepare(`
      INSERT INTO notifications (product_id, kind, price)
      VALUES (@product_id, @kind, @price)
      RETURNING *
    `);
    // Most recent automated notification (excludes test sends).
    this.findLatestStmt = db.prepare(`
      SELECT * FROM notifications
      WHERE product_id = @product_id
        AND kind IN ('alert', 'recovery')
      ORDER BY sent_at DESC, id DESC
      LIMIT 1
    `);
    this.clearForProductStmt = db.prepare(`
      DELETE FROM notifications
      WHERE product_id = @product_id
        AND kind IN ('alert', 'recovery')
    `);
  }

  create(input: CreateNotificationInput): NotificationRecord {
    return this.createStmt.get({
      product_id: input.product_id,
      kind: input.kind,
      price: input.price,
    }) as NotificationRecord;
  }

  findLatest(productId: number): NotificationRecord | null {
    return (this.findLatestStmt.get({ product_id: productId }) as NotificationRecord | undefined) ?? null;
  }

  clearForProduct(productId: number): void {
    this.clearForProductStmt.run({ product_id: productId });
  }
}
