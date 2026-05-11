import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from './migrate';

// Resolve relative SPAWNCAMPER_DB values against the workspace root rather
// than the process cwd. Without this, each package opens its own DB file
// because pnpm runs scripts with cwd = the package dir.
const findWorkspaceRoot = (start: string): string => {
    let dir = start;
    while (true) {
        if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
        const parent = dirname(dir);
        if (parent === dir) return start;
        dir = parent;
    }
};

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = findWorkspaceRoot(here);

const rawDbPath = process.env.SPAWNCAMPER_DB ?? 'spawncamper.db';
const dbPath = isAbsolute(rawDbPath) ? rawDbPath : resolve(workspaceRoot, rawDbPath);

const dbOptions = {
  verbose: console.log,
};
const db: Database.Database = new Database(dbPath, dbOptions);

db.pragma('journal_mode = WAL');
migrate(db);

export { db };

export const testDBConnection = () => {
    console.log(db);
}
