import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { searchWiki, getPageInfo, getField } from "../utils/wikiApi.js";

const EMBED_DESC_LIMIT = 4096;
const EMBED_FIELD_LIMIT = 1024;

const TITLE_OR_DESC_FIELDS = new Set([
  "name",
  "title",
  "title1",
  "description",
  "effect",
  "desc"
]);
const HIDDEN_FIELDS = new Set(["image", "icon", "image1"]);

const FIELD_DISPLAY = [
  { keys: ["oath_req", "oath req"], label: "📊 Oath Requirement", block: true },
  { keys: ["effects"], label: "✨ Effects", block: true },
  { keys: ["rarity"], label: "🌟 Rarity" },
  { keys: ["category"], label: "🗂️ Category" },
  { keys: ["type"], label: "⚔️ Type" },
  { keys: ["ethercost"], label: "💧 Ether Cost" },
  { keys: ["damage"], label: "💥 Damage" },
  { keys: ["damage type", "dmgtype"], label: "🩸 Damage Type" },
  { keys: ["posture damage"], label: "🛡️ Posture Damage" },
  { keys: ["scaling"], label: "📈 Scaling" },
  { keys: ["range"], label: "📏 Range" },
  { keys: ["range type"], label: "📏 Range Type" },
  { keys: ["swing speed"], label: "⚡ Swing Speed" },
  { keys: ["attack duration"], label: "⏱️ Attack Duration" },
  { keys: ["penetration"], label: "🗡️ Penetration" },
  { keys: ["endlag"], label: "⏳ Endlag" },
  { keys: ["stats"], label: "📈 Stats" },
  { keys: ["condition"], label: "⚙️ Condition" },
  { keys: ["reqs", "requirements"], label: "📊 Requirements" },
  { keys: ["oath"], label: "🔰 Oath" },
  { keys: ["selling price"], label: "💰 Selling Price" },
  { keys: ["enchantable"], label: "✨ Enchantable" },
  { keys: ["special effect"], label: "✨ Special Effect", block: true },
  { keys: ["obtainment"], label: "🎯 Obtainment", block: true },
  { keys: ["equipment"], label: "🛡️ Granted By Equipment", block: true },
  { keys: ["tags"], label: "🏷️ Tags", block: true },
  {
    keys: ["mutual exclusives"],
    label: "🚫 Mutually Exclusive With",
    block: true
  },
  { keys: ["additional info"], label: "📝 Additional Info", block: true }
];

function formatFieldText(raw, limit = EMBED_DESC_LIMIT) {
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.trim());
  const formatted = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("*")) {
      const content = line.slice(1).trim();
      if (!content) continue;
      formatted.push(`- ${content}`);
    } else {
      formatted.push(line);
    }
  }

  if (formatted.length === 0) return null;

  let text = formatted.join("\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .replace(/^\s*:\s*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();

  if (text.length > limit) {
    text = text.slice(0, limit - 20).trim() + "\n…(truncated)";
  }

  return text;
}

function inferAttunement(info, pageTitle) {
  const attunement = getField(info, ["attunement", "element"]);
  if (attunement) return attunement;

  const reqs = getField(info, ["reqs", "requirements", "oath_req"]);
  if (reqs) {
    const match = reqs.match(
      /\b(Thundercall|Flamecharm|Frostdraw|Galebreath|Shadowcast|Attunementless)\b/i
    );
    if (match) return match[1];
  }

  const titleLower = (pageTitle || "").toLowerCase();
  const attunements = [
    "thundercall",
    "flamecharm",
    "frostdraw",
    "galebreath",
    "shadowcast"
  ];
  for (const a of attunements) {
    if (titleLower.includes(a)) {
      return a.charAt(0).toUpperCase() + a.slice(1);
    }
  }
  return null;
}

export const data = new SlashCommandBuilder()
  .setName("wiki")
  .setDescription("Look up anything on the Deepwoken Fandom Wiki")
  .addStringOption((opt) =>
    opt
      .setName("name")
      .setDescription("Name of the mantra, talent, weapon, oath, etc.")
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName("type")
      .setDescription("Optional: narrow the search to a specific content type")
      .setRequired(false)
      .addChoices(
        { name: "Mantra", value: "mantra" },
        { name: "Weapon", value: "weapon" },
        { name: "Talent", value: "talent" },
        { name: "Oath", value: "oath" }
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const query = interaction.options.getString("name");
  const type = interaction.options.getString("type");

  const ownPageTitle = await searchWiki(query);

  let pageInfo = await getPageInfo(ownPageTitle || query, query, type);

  if (!pageInfo && type) {
    pageInfo = await getPageInfo(ownPageTitle || query, query, null);
  }

  if (!pageInfo) {
    return interaction.editReply(
      `❌ No info found for **${query}**${type ? ` (type: ${type})` : ""}.`
    );
  }

  const info = pageInfo.infobox;
  if (Object.keys(info).length === 0) {
    return interaction.editReply(`❌ No info found for **${query}**.`);
  }

  return buildAndSendEmbed(interaction, pageInfo, info);
}

function buildAndSendEmbed(interaction, pageInfo, info) {
  const itemName = getField(info, ["name", "title1", "title"]);
  const displayTitle = pageInfo.redirect
    ? `${pageInfo.redirect} → ${itemName || pageInfo.title}`
    : itemName || pageInfo.title;
  const url = `https://deepwoken.fandom.com/wiki/${encodeURIComponent(
    pageInfo.title.replace(/ /g, "_")
  )}`;

  const embed = new EmbedBuilder()
    .setTitle(displayTitle)
    .setURL(url)
    .setColor(0x00aaff)
    .setFooter({ text: "DepthCord • Deepwoken Wiki" });

  const description = getField(info, ["description", "effect", "desc"]) || null;
  embed.setDescription(
    formatFieldText(description) || "No description available."
  );

  const attunement = inferAttunement(info, pageInfo.title);
  const usedKeys = new Set(["attunement", "element"]);
  if (attunement) {
    embed.addFields({ name: "✨ Attunement", value: attunement, inline: true });
  }

  for (const spec of FIELD_DISPLAY) {
    const value = getField(info, spec.keys);
    if (!value) continue;
    spec.keys.forEach((k) => usedKeys.add(k));

    const formatted = spec.block
      ? formatFieldText(value, EMBED_FIELD_LIMIT)
      : value;
    if (!formatted) continue;

    embed.addFields({
      name: spec.label,
      value:
        formatted.length > EMBED_FIELD_LIMIT
          ? formatted.slice(0, EMBED_FIELD_LIMIT - 1) + "…"
          : formatted,
      inline: !spec.block
    });
  }

  for (const key of Object.keys(info)) {
    if (TITLE_OR_DESC_FIELDS.has(key)) continue;
    if (HIDDEN_FIELDS.has(key)) continue;
    if (usedKeys.has(key)) continue;
    if (key.startsWith("_positional_")) continue;

    const value = info[key];
    if (!value) continue;
    const formatted = formatFieldText(value, EMBED_FIELD_LIMIT);
    if (!formatted) continue;

    const label = key
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    embed.addFields({
      name: `❔ ${label}`,
      value:
        formatted.length > EMBED_FIELD_LIMIT
          ? formatted.slice(0, EMBED_FIELD_LIMIT - 1) + "…"
          : formatted,
      inline: false
    });
  }

  return interaction.editReply({ embeds: [embed] });
}
