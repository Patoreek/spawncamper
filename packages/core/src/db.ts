//TODO: Move DB into correct folder
import Database from 'better-sqlite3';
import { migrate } from './migrate';
// const db = require('better-sqlite3')('foobar.db', options);
const dbOptions = {
  verbose: console.log
}
const dbPath = process.env.SPAWNCAMPER_DB ?? 'NO_DB_NAME.db';
const db: Database.Database = new Database(dbPath, dbOptions);

db.pragma('journal_mode = WAL');   // better concurrent reads while you scrape
migrate(db);                        // runs on every process start; cheap because IF NOT EXISTS

export { db };

export const testDBConnection = () => {
    console.log(db);
}
