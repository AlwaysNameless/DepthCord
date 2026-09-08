import db from "../db/index.js";
import { createEmbed } from "./embedBuilder.js";

let scheduledInterval = null;

export function startScheduler(client) {
  if (scheduledInterval) clearInterval(scheduledInterval);

  const CHECK_INTERVAL = 5 * 60 * 1000;
  const REMINDER_WINDOW = 15 * 60 * 1000;

  scheduledInterval = setInterval(() => {
    const now = Date.now();
    const reminderStart = now + REMINDER_WINDOW - 5 * 60 * 1000; // 10 min buffer
    const reminderEnd = now + REMINDER_WINDOW + 5 * 60 * 1000;

    const rows = db
      .prepare(
        `SELECT * FROM events 
         WHERE scheduled_start BETWEEN ? AND ? 
         AND discord_event_id IS NULL`
      )
      .all(reminderStart, reminderEnd);

    if (!rows.length) return;

    const channel = client.channels.cache.get(process.env.EVENT_CHANNEL_ID);
    if (!channel) {
      console.warn("Event channel not found – set EVENT_CHANNEL_ID in .env");
      return;
    }

    for (const row of rows) {
      const roster = JSON.parse(row.roster_json || "[]");
      const mention =
        roster.length > 0
          ? roster.map((id) => `<@${id}>`).join(" ")
          : "No one signed up yet.";

      const embed = createEmbed({
        title: `⏰ Event Reminder: ${row.title}`,
        description: `**${row.event_type}** starting in about 15 minutes!`,
        fields: [
          {
            name: "📅 Time",
            value: `<t:${Math.floor(row.scheduled_start / 1000)}:F>`,
            inline: true
          },
          {
            name: "👥 Signed up",
            value: `${roster.length} people`,
            inline: true
          },
          { name: "🆔 ID", value: `\`${row.event_id}\``, inline: false }
        ],
        footer: `DeepIsCalling • Use /event signup id:${row.event_id} to join`
      });

      channel.send({
        content: `${mention}`,
        embeds: [embed]
      });

      db.prepare(
        `UPDATE events SET discord_event_id = ? WHERE event_id = ?`
      ).run(`reminded_${Date.now()}`, row.event_id);
    }
  }, CHECK_INTERVAL);

  console.log("✅ Event scheduler started (checking every 5 minutes)");
}

export function stopScheduler() {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
    console.log("🛑 Event scheduler stopped");
  }
}
