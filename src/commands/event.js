import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from "discord.js";
import { randomUUID } from "crypto";
import {
  createEvent,
  getEvent,
  updateRoster,
  deleteEvent,
  listEvents
} from "../db/queries/events.js";
import { errorEmbed, successEmbed } from "../utils/embedBuilder.js";

const ALLOWED_ROLES = ["1546667474832068649"];

function hasPermission(interaction) {
  return interaction.member.roles.cache.some((role) =>
    ALLOWED_ROLES.includes(role.id)
  );
}

function buildEventEmbed(event) {
  const roster = event.roster || [];
  const attendees =
    roster.length > 0
      ? roster.map((id) => `<@${id}>`).join("\n")
      : "No one yet";
  const count = roster.length;

  const timeDisplay = event.time_raw || "Time not set";

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.title}`)
    .setColor(0x00aaff)
    .setDescription(
      `**Type:** ${event.event_type}\n` +
        `**Time:** ${timeDisplay}\n` +
        `**Attending:** ${count} members`
    )
    .addFields({ name: "👥 Attendees", value: attendees, inline: false })
    .setFooter({
      text: `Event ID: ${event.event_id} • DepthCord • By Nameless`
    })
    .setTimestamp();

  return embed;
}

function buildEventButtons(eventId) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`event_join_${eventId}`)
      .setLabel("Join")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`event_leave_${eventId}`)
      .setLabel("Leave")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`event_view_${eventId}`)
      .setLabel("View Attendees")
      .setStyle(ButtonStyle.Secondary)
  );

  return row;
}

export const data = new SlashCommandBuilder()
  .setName("event")
  .setDescription("Manage guild events")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Create a new event")
      .addStringOption((opt) =>
        opt.setName("title").setDescription("Event title").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("type")
          .setDescription("Event type")
          .setRequired(true)
          .addChoices(
            { name: "PVE Event", value: "pve" },
            { name: "PVP Event", value: "pvp" },
            { name: "Carry", value: "carry" },
            { name: "Other", value: "other" }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("time")
          .setDescription(
            'When? e.g. "tomorrow at 8pm EST", "in 2 hours", "whenever"'
          )
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub.setName("list").setDescription("List all upcoming events")
  )
  .addSubcommand((sub) =>
    sub
      .setName("delete")
      .setDescription("Delete an event")
      .addStringOption((opt) =>
        opt
          .setName("id")
          .setDescription("Event ID")
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const events = listEvents();

  const filtered = events
    .filter(
      (e) =>
        e.event_id.toLowerCase().includes(focusedValue.toLowerCase()) ||
        e.title.toLowerCase().includes(focusedValue.toLowerCase())
    )
    .slice(0, 25);

  await interaction.respond(
    filtered.map((e) => ({
      name: `${e.title} (${e.event_id})`,
      value: e.event_id
    }))
  );
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === "create" || sub === "delete") {
    if (!hasPermission(interaction)) {
      return interaction.reply({
        embeds: [
          errorEmbed("❌ You don't have permission to use this command.")
        ],
        flags: 64
      });
    }
  }

  if (sub === "create") {
    const title = interaction.options.getString("title");
    const type = interaction.options.getString("type");
    const timeStr = interaction.options.getString("time");

    // Use current time + 1 hour as default sort time, but display whatever the user typed
    const timestamp = Date.now() + 3600000; // 1 hour from now

    const eventId = randomUUID().slice(0, 8);
    const roster = [];

    try {
      createEvent({
        id: eventId,
        title,
        type,
        startTime: timestamp,
        timeRaw: timeStr, // Store exactly what the user typed
        discordEventId: null,
        roster
      });

      const event = getEvent(eventId);
      const embed = buildEventEmbed(event);
      const buttons = buildEventButtons(eventId);

      return interaction.reply({
        embeds: [embed],
        components: [buttons]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [errorEmbed(`Failed to create event: ${error.message}`)],
        flags: 64
      });
    }
  }

  if (sub === "list") {
    const events = listEvents();
    const now = Date.now();

    const upcoming = events
      .filter((e) => e.scheduled_start > now)
      .sort((a, b) => a.scheduled_start - b.scheduled_start);

    if (!upcoming.length) {
      return interaction.reply({
        embeds: [errorEmbed("No upcoming events.")],
        flags: 64
      });
    }

    const listText = upcoming
      .map((e, i) => {
        const rosterCount = JSON.parse(e.roster_json || "[]").length;
        const timeDisplay = e.time_raw || "Time not set";
        return `${i + 1}. \`${e.event_id}\` **${e.title}** (${e.event_type}) – ${timeDisplay} – ${rosterCount} attending`;
      })
      .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📅 Upcoming Events")
      .setColor(0x00aaff)
      .setDescription(
        listText.length > 4000 ? listText.slice(0, 4000) + "..." : listText
      )
      .setFooter({
        text: `Total: ${upcoming.length} events • DepthCord • By Nameless`
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], flags: 64 });
  }

  if (sub === "delete") {
    const id = interaction.options.getString("id");
    try {
      const result = deleteEvent(id);
      if (result.changes === 0) {
        return interaction.reply({
          embeds: [errorEmbed(`❌ No event found with ID \`${id}\``)],
          flags: 64
        });
      }
      return interaction.reply({
        embeds: [successEmbed(`✅ Event \`${id}\` deleted.`)]
      });
    } catch (error) {
      return interaction.reply({
        embeds: [errorEmbed(`Failed to delete event: ${error.message}`)],
        flags: 64
      });
    }
  }

  return interaction.reply({
    embeds: [errorEmbed("Unknown subcommand")],
    flags: 64
  });
}

// Button Handler
export async function handleButton(interaction) {
  const customId = interaction.customId;
  const userId = interaction.user.id;

  if (customId.startsWith("event_join_")) {
    const eventId = customId.replace("event_join_", "");
    const event = getEvent(eventId);
    if (!event) {
      return interaction.reply({
        embeds: [errorEmbed(`❌ Event not found.`)],
        flags: 64
      });
    }

    let roster = event.roster || [];
    if (roster.includes(userId)) {
      return interaction.reply({
        embeds: [errorEmbed(`❌ You're already attending **${event.title}**.`)],
        flags: 64
      });
    }

    roster.push(userId);
    updateRoster(eventId, roster);

    const updatedEvent = getEvent(eventId);
    const embed = buildEventEmbed(updatedEvent);
    const buttons = buildEventButtons(eventId);

    return interaction.update({
      embeds: [embed],
      components: [buttons]
    });
  }

  if (customId.startsWith("event_leave_")) {
    const eventId = customId.replace("event_leave_", "");
    const event = getEvent(eventId);
    if (!event) {
      return interaction.reply({
        embeds: [errorEmbed(`❌ Event not found.`)],
        flags: 64
      });
    }

    let roster = event.roster || [];
    if (!roster.includes(userId)) {
      return interaction.reply({
        embeds: [errorEmbed(`❌ You're not attending **${event.title}**.`)],
        flags: 64
      });
    }

    roster = roster.filter((id) => id !== userId);
    updateRoster(eventId, roster);

    const updatedEvent = getEvent(eventId);
    const embed = buildEventEmbed(updatedEvent);
    const buttons = buildEventButtons(eventId);

    return interaction.update({
      embeds: [embed],
      components: [buttons]
    });
  }

  if (customId.startsWith("event_view_")) {
    const eventId = customId.replace("event_view_", "");
    const event = getEvent(eventId);
    if (!event) {
      return interaction.reply({
        embeds: [errorEmbed(`❌ Event not found.`)],
        flags: 64
      });
    }

    const roster = event.roster || [];
    const attendees = roster.length
      ? roster.map((id) => `<@${id}>`).join("\n")
      : "No one yet";

    const embed = new EmbedBuilder()
      .setTitle(`👥 Attendees for ${event.title}`)
      .setColor(0x00aaff)
      .setDescription(`**Total:** ${roster.length} members\n\n${attendees}`)
      .setFooter({
        text: `Event ID: ${event.event_id} • DepthCord • By Nameless`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      flags: 64
    });
  }
}
