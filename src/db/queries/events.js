import db from "../index.js";

export function createEvent({
  id,
  title,
  type,
  startTime,
  timeRaw,
  discordEventId,
  roster
}) {
  const stmt = db.prepare(`
    INSERT INTO events (event_id, title, event_type, scheduled_start, time_raw, discord_event_id, roster_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    id,
    title,
    type,
    startTime,
    timeRaw,
    discordEventId,
    JSON.stringify(roster)
  );
}

export function getEvent(eventId) {
  const stmt = db.prepare(`SELECT * FROM events WHERE event_id = ?`);
  const row = stmt.get(eventId);

  if (!row) return null;

  return {
    ...row,
    roster: JSON.parse(row.roster_json)
  };
}

export function listEvents() {
  const stmt = db.prepare(`SELECT * FROM events ORDER BY scheduled_start ASC`);
  return stmt.all();
}

export function updateRoster(eventId, roster) {
  const stmt = db.prepare(
    `UPDATE events SET roster_json = ? WHERE event_id = ?`
  );
  return stmt.run(JSON.stringify(roster), eventId);
}

export function deleteEvent(eventId) {
  const stmt = db.prepare(`DELETE FROM events WHERE event_id = ?`);
  return stmt.run(eventId);
}
