import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  addTarget,
  getTarget,
  removeTarget,
  listTargets
} from "../db/queries/registry.js";
import {
  createEmbed,
  errorEmbed,
  successEmbed
} from "../utils/embedBuilder.js";

export const data = new SlashCommandBuilder()
  .setName("registry")
  .setDescription("Manage diplomatic standings (allies/enemies/ganker)")
  .addSubcommand((sub) =>
    sub
      .setName("add")
      .setDescription("Add or update a guild entry")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Guild name").setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("alignment")
          .setDescription("Diplomatic stance")
          .setRequired(true)
          .addChoices(
            { name: "Ally", value: "ally" },
            { name: "Enemy", value: "enemy" },
            { name: "Ganker", value: "ganker" }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for this stance")
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("remove")
      .setDescription("Remove a guild from the registry")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Guild name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("list")
      .setDescription("List all entries filtered by alignment")
      .addStringOption((opt) =>
        opt
          .setName("alignment")
          .setDescription("Filter by alignment")
          .addChoices(
            { name: "All", value: "all" },
            { name: "Ally", value: "ally" },
            { name: "Enemy", value: "enemy" },
            { name: "Ganker", value: "ganker" }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("View detailed information about a specific entry")
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Guild name")
          .setRequired(true)
          .setAutocomplete(true)
      )
  );

const ALLOWED_ROLES = ["1535374890566287392", "1535374892260925541"];

function hasPermission(interaction) {
  return interaction.member.roles.cache.some((role) =>
    ALLOWED_ROLES.includes(role.id)
  );
}

export async function autocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const entries = listTargets("all");

  const filtered = entries
    .filter((entry) =>
      entry.name.toLowerCase().includes(focusedValue.toLowerCase())
    )
    .slice(0, 25);

  await interaction.respond(
    filtered.map((entry) => ({
      name: `${entry.name} (${entry.alignment})`,
      value: entry.name
    }))
  );
}

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const name = interaction.options.getString("name");

  if (sub === "add" || sub === "remove") {
    if (!hasPermission(interaction)) {
      return interaction.reply({
        embeds: [
          errorEmbed("❌ You don't have permission to use this command.")
        ],
        flags: 64
      });
    }
  }

  if (sub === "add") {
    const type = "guild";
    const alignment = interaction.options.getString("alignment");
    const reason = interaction.options.getString("reason");
    const addedBy = interaction.user.tag;
    const proofUrl = "";

    try {
      addTarget({ name, type, alignment, reason, addedBy, proofUrl });
      const embed = successEmbed(`**${name}** added as **${alignment}**.`);
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      return interaction.reply({
        embeds: [errorEmbed(`Failed to add: ${err.message}`)],
        flags: 64
      });
    }
  }

  if (sub === "remove") {
    const existing = getTarget(name);
    if (!existing) {
      return interaction.reply({
        embeds: [errorEmbed(`**${name}** not found in registry.`)],
        flags: 64
      });
    }
    removeTarget(name);
    const embed = successEmbed(`Removed **${name}** from registry.`);
    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "view") {
    const entry = getTarget(name);
    if (!entry) {
      return interaction.reply({
        embeds: [errorEmbed(`**${name}** not found in registry.`)],
        flags: 64
      });
    }

    const emoji =
      entry.alignment === "ally"
        ? "🤝"
        : entry.alignment === "enemy"
          ? "⚔️"
          : "🔪";
    const color =
      entry.alignment === "ally"
        ? 0x44ff44
        : entry.alignment === "enemy"
          ? 0xff4444
          : 0xff8800;

    const embed = new EmbedBuilder()
      .setTitle(`${emoji} ${entry.name}`)
      .setColor(color)
      .setDescription(
        `**Alignment:** ${entry.alignment}\n**Reason:** ${entry.reason || "No reason provided"}\n**Added by:** ${entry.added_by || "Unknown"}\n**Added on:** <t:${Math.floor(entry.created_at / 1000)}:F>`
      )
      .setFooter({ text: "DepthCord • By Nameless" });

    return interaction.reply({ embeds: [embed] });
  }

  if (sub === "list") {
    const alignment = interaction.options.getString("alignment") || "all";
    const entries = listTargets(alignment);

    if (!entries.length) {
      return interaction.reply({
        embeds: [
          errorEmbed(
            `No entries found${alignment !== "all" ? ` with alignment **${alignment}**` : ""}.`
          )
        ],
        flags: 64
      });
    }

    const listText = entries
      .map((e, i) => {
        const emoji =
          e.alignment === "ally" ? "🤝" : e.alignment === "enemy" ? "⚔️" : "🔪";
        return `${i + 1}. ${emoji} **${e.name}** – ${e.alignment}`;
      })
      .join("\n");

    const embed = createEmbed({
      title: `📋 Diplomatic Registry ${alignment !== "all" ? `(${alignment})` : ""}`,
      description:
        listText.length > 4000 ? listText.slice(0, 4000) + "..." : listText,
      footer: `Total: ${entries.length} entries • By Nameless`
    });

    return interaction.reply({ embeds: [embed], flags: 64 });
  }

  return interaction.reply({
    embeds: [errorEmbed("Unknown subcommand")],
    flags: 64
  });
}
