import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
  addTarget,
  getTarget,
  removeTarget,
  listTargets,
} from "../db/queries/registry.js";
import {
  createEmbed,
  errorEmbed,
  successEmbed,
} from "../utils/embedBuilder.js";

const ROLES = ["1535374890566287392", "1535374892260925541"];

const icon = (a) => (a === "ally" ? "🤝" : a === "enemy" ? "⚔️" : "🔪");
const tint = (a) =>
  a === "ally" ? 0x44ff44 : a === "enemy" ? 0xff4444 : 0xff8800;

const ok = (i) => i.member.roles.cache.some((r) => ROLES.includes(r.id));

export const data = new SlashCommandBuilder()
  .setName("registry")
  .setDescription("Manage diplomatic standings (allies/enemies/ganker)")
  .addSubcommand((s) =>
    s
      .setName("add")
      .setDescription("Add or update a guild entry")
      .addStringOption((o) =>
        o.setName("name").setDescription("Guild name").setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName("alignment")
          .setDescription("Diplomatic stance")
          .setRequired(true)
          .addChoices(
            { name: "Ally", value: "ally" },
            { name: "Enemy", value: "enemy" },
            { name: "Ganker", value: "ganker" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("reason")
          .setDescription("Reason for this stance")
          .setRequired(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("remove")
      .setDescription("Remove a guild from the registry")
      .addStringOption((o) =>
        o
          .setName("name")
          .setDescription("Guild name")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("list")
      .setDescription("List all entries filtered by alignment")
      .addStringOption((o) =>
        o
          .setName("alignment")
          .setDescription("Filter by alignment")
          .addChoices(
            { name: "All", value: "all" },
            { name: "Ally", value: "ally" },
            { name: "Enemy", value: "enemy" },
            { name: "Ganker", value: "ganker" },
          ),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName("view")
      .setDescription("View detailed information about a specific entry")
      .addStringOption((o) =>
        o
          .setName("name")
          .setDescription("Guild name")
          .setRequired(true)
          .setAutocomplete(true),
      ),
  );

export async function autocomplete(i) {
  const q = i.options.getFocused().toLowerCase();
  const hits = listTargets("all")
    .filter((e) => e.name.toLowerCase().includes(q))
    .slice(0, 25);

  await i.respond(
    hits.map((e) => ({ name: `${e.name} (${e.alignment})`, value: e.name })),
  );
}

export async function execute(i) {
  const sub = i.options.getSubcommand();
  const name = i.options.getString("name");

  if ((sub === "add" || sub === "remove") && !ok(i)) {
    return i.reply({
      embeds: [errorEmbed("❌ You don't have permission to use this command.")],
      flags: 64,
    });
  }

  if (sub === "add") {
    try {
      addTarget({
        name,
        type: "guild",
        alignment: i.options.getString("alignment"),
        reason: i.options.getString("reason"),
        addedBy: i.user.tag,
        proofUrl: "",
      });
      return i.reply({
        embeds: [
          successEmbed(
            `**${name}** added as **${i.options.getString("alignment")}**.`,
          ),
        ],
      });
    } catch (e) {
      return i.reply({
        embeds: [errorEmbed(`Failed to add: ${e.message}`)],
        flags: 64,
      });
    }
  }

  if (sub === "remove") {
    if (!getTarget(name)) {
      return i.reply({
        embeds: [errorEmbed(`**${name}** not found in registry.`)],
        flags: 64,
      });
    }
    removeTarget(name);
    return i.reply({
      embeds: [successEmbed(`Removed **${name}** from registry.`)],
    });
  }

  if (sub === "view") {
    const e = getTarget(name);
    if (!e) {
      return i.reply({
        embeds: [errorEmbed(`**${name}** not found in registry.`)],
        flags: 64,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${icon(e.alignment)} ${e.name}`)
      .setColor(tint(e.alignment))
      .setDescription(
        `**Alignment:** ${e.alignment}\n**Reason:** ${e.reason || "No reason provided"}\n**Added by:** ${e.added_by || "Unknown"}\n**Added on:** <t:${Math.floor(e.created_at / 1000)}:F>`,
      )
      .setFooter({ text: "DepthCord • By Nameless" });

    return i.reply({ embeds: [embed] });
  }

  if (sub === "list") {
    const a = i.options.getString("alignment") || "all";
    const entries = listTargets(a);

    if (!entries.length) {
      return i.reply({
        embeds: [
          errorEmbed(
            `No entries found${a !== "all" ? ` with alignment **${a}**` : ""}.`,
          ),
        ],
        flags: 64,
      });
    }

    const lines = entries
      .map(
        (e, n) =>
          `${n + 1}. ${icon(e.alignment)} **${e.name}** – ${e.alignment}`,
      )
      .join("\n");

    return i.reply({
      embeds: [
        createEmbed({
          title: `📋 Diplomatic Registry ${a !== "all" ? `(${a})` : ""}`,
          description:
            lines.length > 4000 ? lines.slice(0, 4000) + "..." : lines,
          footer: `Total: ${entries.length} entries • By Nameless`,
        }),
      ],
      flags: 64,
    });
  }

  return i.reply({ embeds: [errorEmbed("Unknown subcommand")], flags: 64 });
}
