import db from "../index.js";

export function createEvent({
  id,
  title,
  type,
  startTime,
  timeRaw,
  discordEventId,
  roster,
}) {
  return db
    .prepare(
      `INSERT INTO events (event_id, title, event_type, scheduled_start, time_raw, discord_event_id, roster_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      title,
      type,
      startTime,
      timeRaw,
      discordEventId,
      JSON.stringify(roster),
    );
}

export function getEvent(id) {
  const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(id);
  return row ? { ...row, roster: JSON.parse(row.roster_json) } : null;
}

export function listEvents() {
  return db.prepare("SELECT * FROM events ORDER BY scheduled_start ASC").all();
}

export function updateRoster(id, roster) {
  return db
    .prepare("UPDATE events SET roster_json = ? WHERE event_id = ?")
    .run(JSON.stringify(roster), id);
}

export function deleteEvent(id) {
  return db.prepare("DELETE FROM events WHERE event_id = ?").run(id);
}
