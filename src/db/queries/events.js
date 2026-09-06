import db from "../index.js";

// Creates a new scheduled event in SQLite
export function createEvent({
  id,
  title,
  type,
  startTime,
  discordEventId,
  roster
}) {
  const stmt = db.prepare(`
    INSERT INTO events (event_id, title, event_type, scheduled_start, discord_event_id, roster_json)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    id,
    title,
    type,
    startTime,
    discordEventId,
    JSON.stringify(roster)
  );
}

// Retrieves an event by its ID and parses the roster JSON back into a JS object
export function getEvent(eventId) {
  const stmt = db.prepare(`SELECT * FROM events WHERE event_id = ?`);
  const row = stmt.get(eventId);

  if (!row) return null;

  return {
    ...row,
    roster: JSON.parse(row.roster_json)
  };
}

// Updates the signup roster for an existing event
export function updateRoster(eventId, roster) {
  const stmt = db.prepare(
    `UPDATE events SET roster_json = ? WHERE event_id = ?`
  );
  return stmt.run(JSON.stringify(roster), eventId);
}

// Deletes an event from the database
export function deleteEvent(eventId) {
  const stmt = db.prepare(`DELETE FROM events WHERE event_id = ?`);
  return stmt.run(eventId);
}
