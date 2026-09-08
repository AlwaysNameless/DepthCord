import db from "../index.js";
import crypto from "node:crypto";

export function addTarget({
  name,
  type,
  alignment,
  reason,
  addedBy,
  proofUrl
}) {
  const stmt = db.prepare(`
    INSERT INTO registry (entity_id, name, type, alignment, reason, added_by, proof_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      alignment = excluded.alignment,
      reason = excluded.reason,
      proof_url = excluded.proof_url
  `);

  const id = crypto.randomUUID();
  const now = Date.now();

  return stmt.run(
    id,
    name.toLowerCase(),
    type,
    alignment,
    reason,
    addedBy,
    proofUrl,
    now
  );
}

export function getTarget(name) {
  const stmt = db.prepare(`SELECT * FROM registry WHERE name = ?`);
  return stmt.get(name.toLowerCase());
}

export function removeTarget(name) {
  const stmt = db.prepare(`DELETE FROM registry WHERE name = ?`);
  return stmt.run(name.toLowerCase());
}

export function listTargets(alignment = null) {
  let query = "SELECT * FROM registry";
  const params = [];
  if (alignment && alignment !== "all") {
    query += " WHERE alignment = ?";
    params.push(alignment);
  }
  query += " ORDER BY name ASC";
  const stmt = db.prepare(query);
  return stmt.all(...params);
}
