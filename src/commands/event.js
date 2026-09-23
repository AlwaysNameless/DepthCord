import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { randomUUID } from "crypto";
import {
  createEvent,
  getEvent,
  updateRoster,
  deleteEvent,
  listEvents,
} from "../db/queries/events.js";
import { errorEmbed, successEmbed } from "../utils/embedBuilder.js";

const ROLES = [
  "1546667474832068649",
  "1535374890566287392",
  "1535374892260925541",
  "1535374893607034950",
  "1535374898229289040",
  "1535374899676450916",
  "1535374896874655915",
];

const ok = (i) => i.member.roles.cache.some((r) => ROLES.includes(r.id));

function embed(ev) {
  const roster = ev.roster || [];
  const names = roster.length
    ? roster.map((id) => `<@${id}>`).join("\n")
    : "No one yet";

  return new EmbedBuilder()
    .setTitle(`📅 ${ev.title}`)
    .setColor(0x00aaff)
    .setDescription(
      `**Type:** ${ev.event_type}\n**Time:** ${ev.time_raw || "Time not set"}\n**Attending:** ${roster.length} members`,
    )
    .addFields({ name: "👥 Attendees", value: names })
    .setFooter({ text: `Event ID: ${ev.event_id} • DepthCord • By Nameless` })
    .setTimestamp();
}

function buttons(id) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_join_${id}`)
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`event_leave_${id}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`event_view_${id}`)
      .setLabel("View Attendees")
      .setStyle(ButtonStyle.Secondary),
  );
}

export const data = new SlashCommandBuilder()
  .setName("event")
  .setDescription("Manage guild events")
  .addSubcommand((s) =>
    s
      .setName("create")
      .setDescription("Create a new event")
      .addStringOption((o) =>
        o.setName("title").setDescription("Event title").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("type")
          .setDescription("Event type")
          .setRequired(true)
          .addChoices(
            { name: "PVE Event", value: "pve" },
            { name: "PVP Event", value: "pvp" },
            { name: "Carry", value: "carry" },
            { name: "Other", value: "other" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("time")
          .setDescription(
            'When? e.g. "tomorrow at 8pm EST", "in 2 hours", "whenever"',
          )
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s.setName("list").setDescription("List all upcoming events"),
  )
  .addSubcommand((s) =>
    s
      .setName("delete")
      .setDescription("Delete an event")
      .addStringOption((o) =>
        o
          .setName("id")
          .setDescription("Event ID")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

export async function autocomplete(i) {
  const q = i.options.getFocused().toLowerCase();
  const events = listEvents()
    .filter((e) => e.event_id.includes(q) || e.title.toLowerCase().includes(q))
    .slice(0, 25);

  await i.respond(
    events.map((e) => ({
      name: `${e.title} (${e.event_id})`,
      value: e.event_id,
    })),
  );
}

export async function execute(i) {
  const sub = i.options.getSubcommand();

  if ((sub === "create" || sub === "delete") && !ok(i)) {
    return i.reply({
      embeds: [errorEmbed("❌ You don't have permission to use this command.")],
      flags: 64,
    });
  }

  if (sub === "create") {
    const title = i.options.getString("title");
    const type = i.options.getString("type");
    const time = i.options.getString("time");
    const id = randomUUID().slice(0, 8);

    try {
      createEvent({
        id,
        title,
        type,
        startTime: Date.now() + 3600000,
        timeRaw: time,
        discordEventId: null,
        roster: [],
      });

      return i.reply({
        embeds: [embed(getEvent(id))],
        components: [buttons(id)],
      });
    } catch (err) {
      return i.reply({
        embeds: [errorEmbed(`Failed to create event: ${err.message}`)],
        flags: 64,
      });
    }
  }

  if (sub === "list") {
    const now = Date.now();
    const upcoming = listEvents()
      .filter((e) => e.scheduled_start > now)
      .sort((a, b) => a.scheduled_start - b.scheduled_start);

    if (!upcoming.length) {
      return i.reply({
        embeds: [errorEmbed("No upcoming events.")],
        flags: 64,
      });
    }

    const lines = upcoming
      .map((e, n) => {
        const count = JSON.parse(e.roster_json || "[]").length;
        return `${n + 1}. \`${e.event_id}\` **${e.title}** (${e.event_type}) – ${e.time_raw || "Time not set"} – ${count} attending`;
      })
      .join("\n");

    const e = new EmbedBuilder()
      .setTitle("📅 Upcoming Events")
      .setColor(0x00aaff)
      .setDescription(
        lines.length > 4000 ? lines.slice(0, 4000) + "..." : lines,
      )
      .setFooter({
        text: `Total: ${upcoming.length} events • DepthCord • By Nameless`,
      })
      .setTimestamp();

    return i.reply({ embeds: [e], flags: 64 });
  }

  if (sub === "delete") {
    const id = i.options.getString("id");
    try {
      const res = deleteEvent(id);
      if (res.changes === 0) {
        return i.reply({
          embeds: [errorEmbed(`❌ No event found with ID \`${id}\``)],
          flags: 64,
        });
      }
      return i.reply({ embeds: [successEmbed(`✅ Event \`${id}\` deleted.`)] });
    } catch (err) {
      return i.reply({
        embeds: [errorEmbed(`Failed to delete event: ${err.message}`)],
        flags: 64,
      });
    }
  }

  return i.reply({ embeds: [errorEmbed("Unknown subcommand")], flags: 64 });
}

export async function handleButton(i) {
  const cid = i.customId;
  const uid = i.user.id;

  if (cid.startsWith("event_join_")) {
    const id = cid.replace("event_join_", "");
    const ev = getEvent(id);
    if (!ev)
      return i.reply({
        embeds: [errorEmbed("❌ Event not found.")],
        flags: 64,
      });

    const roster = ev.roster || [];
    if (roster.includes(uid)) {
      return i.reply({
        embeds: [errorEmbed(`❌ You're already attending **${ev.title}**.`)],
        flags: 64,
      });
    }

    roster.push(uid);
    updateRoster(id, roster);

    return i.update({
      embeds: [embed(getEvent(id))],
      components: [buttons(id)],
    });
  }

  if (cid.startsWith("event_leave_")) {
    const id = cid.replace("event_leave_", "");
    const ev = getEvent(id);
    if (!ev)
      return i.reply({
        embeds: [errorEmbed("❌ Event not found.")],
        flags: 64,
      });

    const roster = ev.roster || [];
    if (!roster.includes(uid)) {
      return i.reply({
        embeds: [errorEmbed(`❌ You're not attending **${ev.title}**.`)],
        flags: 64,
      });
    }

    updateRoster(
      id,
      roster.filter((u) => u !== uid),
    );

    return i.update({
      embeds: [embed(getEvent(id))],
      components: [buttons(id)],
    });
  }

  if (cid.startsWith("event_view_")) {
    const id = cid.replace("event_view_", "");
    const ev = getEvent(id);
    if (!ev)
      return i.reply({
        embeds: [errorEmbed("❌ Event not found.")],
        flags: 64,
      });

    const roster = ev.roster || [];
    const names = roster.length
      ? roster.map((u) => `<@${u}>`).join("\n")
      : "No one yet";

    const e = new EmbedBuilder()
      .setTitle(`👥 Attendees for ${ev.title}`)
      .setColor(0x00aaff)
      .setDescription(`**Total:** ${roster.length} members\n\n${names}`)
      .setFooter({ text: `Event ID: ${ev.event_id} • DepthCord • By Nameless` })
      .setTimestamp();

    return i.reply({ embeds: [e], flags: 64 });
  }
}
