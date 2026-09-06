import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../../data/deepiscalling.db");
const schemaPath = path.resolve(__dirname, "./schema.sql");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

const schema = fs.readFileSync(schemaPath, "utf-8");
db.exec(schema);

export default db;
