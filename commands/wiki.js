import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { searchWiki, getPageWikitext, parseInfobox } from "../utils/wikiApi.js";

export const data = new SlashCommandBuilder()
  .setName("wiki")
  .setDescription("Query the Deepwoken Fandom Database")
  .addSubcommand((sub) =>
    sub
      .setName("mantra")
      .setDescription("Get details on a specific Mantra")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Mantra name").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("talent")
      .setDescription("Get details on a specific Talent card")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Talent name").setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName("weapon")
      .setDescription("Get weapon scaling, requirements, and base stats")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Weapon name").setRequired(true)
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const subcommand = interaction.options.getSubcommand();
  const query = interaction.options.getString("name");

  const matchedTitle = await searchWiki(query);
  if (!matchedTitle) {
    return interaction.editReply(
      `❌ No wiki entry found matching **${query}**.`
    );
  }

  const page = await getPageWikitext(matchedTitle);
  if (!page) {
    return interaction.editReply(
      `❌ Failed to retrieve page content for **${matchedTitle}**.`
    );
  }

  const info = parseInfobox(page.wikitext);
  const pageUrl = `https://deepwoken.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;

  const embed = new EmbedBuilder()
    .setTitle(page.title)
    .setURL(pageUrl)
    .setColor(0x00aaff)
    .setFooter({ text: "DeepIsCalling • Deepwoken Database" });

  if (subcommand === "mantra") {
    embed
      .setDescription(info.description || "No description available.")
      .addFields(
        {
          name: "✨ Attunement",
          value: info.attunement || "Universal",
          inline: true
        },
        { name: "💧 Ether Cost", value: info.ether || "N/A", inline: true },
        {
          name: "📊 Stat Req",
          value: info.req || info.requirements || "None",
          inline: true
        }
      );
  } else if (subcommand === "talent") {
    embed
      .setDescription(info.description || "No description available.")
      .addFields(
        {
          name: "🏷️ Category",
          value: info.category || "General",
          inline: true
        },
        { name: "🎯 Rarity", value: info.rarity || "Common", inline: true }
      );
  } else if (subcommand === "weapon") {
    embed.addFields(
      { name: "⚔️ Weapon Type", value: info.type || "N/A", inline: true },
      { name: "📈 Scaling", value: info.scaling || "N/A", inline: true },
      { name: "🎯 Base Damage", value: info.damage || "N/A", inline: true }
    );
  }

  return interaction.editReply({ embeds: [embed] });
}
