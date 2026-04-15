/**
 * SHARED DATABASE CONNECTION
 * Single SQLite instance for the whole process.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, resolve } from "path";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const path = resolve(process.env.DATABASE_URL ?? "./data/ir-os.db");
    mkdirSync(dirname(path), { recursive: true });
    _db = new Database(path);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
  }
  return _db;
}

export function closeDb(): void {
  _db?.close();
  _db = null;
}
