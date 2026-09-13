import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { searchWiki, getPageInfo, getField } from "../utils/wikiApi.js";

const EMBED_DESC_LIMIT = 4096;
const EMBED_FIELD_LIMIT = 1024;

const TITLE_OR_DESC_FIELDS = new Set([
  "name",
  "npcname",
  "title",
  "title1",
  "description",
  "effect",
  "desc"
]);

const HIDDEN_FIELDS = new Set([
  "image",
  "image1",
  "image2",
  "image3",
  "icon",
  "caption",
  "caption1",
  "alt",
  "bankable",
  "passable",
  "fishingquote",
  "m.equip",
  "m equip"
]);

const FIELD_DISPLAY = [
  // ── Common meta ────────────────────────────────────────────
  { keys: ["rarity"], label: "🌟 Rarity" },
  { keys: ["category"], label: "🗂️ Category" },
  { keys: ["type"], label: "⚔️ Type" },
  { keys: ["tier"], label: "🏆 Tier" },

  // ── Weapons ────────────────────────────────────────────────
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
  { keys: ["enchantable"], label: "✨ Enchantable" },

  // ── Mantras ────────────────────────────────────────────────
  { keys: ["ethercost", "ether cost"], label: "💧 Ether Cost" },
  { keys: ["cooldown"], label: "⏱️ Cooldown" },

  // ── Enchantments / Oaths ───────────────────────────────────
  { keys: ["droppable"], label: "📦 Droppable" },
  { keys: ["pass down"], label: "🔁 Pass Down" },
  { keys: ["oath_req", "oath req"], label: "📊 Oath Requirement", block: true },
  { keys: ["effects"], label: "✨ Effects", block: true },

  // ── Equipment (EquipInfobox) ───────────────────────────────
  { keys: ["requirements"], label: "📊 Requirements" },
  {
    keys: ["innate stats", "innate_stats"],
    label: "📈 Innate Stats",
    block: true
  },
  { keys: ["innate talent", "innate tlent"], label: "🎯 Innate Talent" },
  { keys: ["set"], label: "👕 Set" },
  { keys: ["set name"], label: "🏷️ Set Name" },
  { keys: ["set talent"], label: "⚡ Set Talent" },
  { keys: ["styles"], label: "🎨 Styles" },
  { keys: ["weight"], label: "⚖️ Weight" },
  { keys: ["faction"], label: "🏛️ Faction" },

  // ── Outfit (OutfitInfobox) ─────────────────────────────────
  { keys: ["durability"], label: "🔧 Durability" },
  { keys: ["resistances"], label: "🛡️ Resistances", block: true },
  { keys: ["buffs"], label: "✨ Buffs", block: true },
  { keys: ["talents"], label: "🎯 Talents", block: true },
  { keys: ["stat_req", "stat req", "stat_req"], label: "📊 Stat Requirement" },
  { keys: ["crafting req", "crafting_req"], label: "🔨 Crafting", block: true },
  { keys: ["shirt", "shirt2", "pants"], label: "👕 Slots", block: true },
  {
    keys: ["price", "selling price", "selling_price", "sell"],
    label: "💰 Price"
  },

  // ── NPC / Character (shared fields) ────────────────────────
  { keys: ["affiliation"], label: "🏛️ Affiliation" },
  { keys: ["alias"], label: "📛 Alias" },
  { keys: ["aspect"], label: "✨ Aspect" },
  { keys: ["species"], label: "🧬 Species" },
  { keys: ["pronouns"], label: "👤 Pronouns" },
  { keys: ["family"], label: "👪 Family" },
  { keys: ["purpose"], label: "🎯 Purpose", block: true },
  { keys: ["location", "located"], label: "📍 Location", block: true },

  // ── NPC death info ─────────────────────────────────────────
  { keys: ["death"], label: "☠️ Death", block: true },
  { keys: ["deathdate"], label: "📅 Death Date" },

  // ── Enemy / Monster ────────────────────────────────────────
  { keys: ["health"], label: "❤️ Health" },
  { keys: ["weapon"], label: "🗡️ Weapon" },
  { keys: ["moves"], label: "⚔️ Moves", block: true },
  { keys: ["attacks"], label: "⚔️ Attacks", block: true },
  { keys: ["tacks"], label: "⚔️ Attacks", block: true },
  { keys: ["behavior"], label: "🧠 Behavior", block: true },
  { keys: ["challenges"], label: "🏆 Challenges", block: true },
  { keys: ["drops"], label: "💧 Drops", block: true },
  { keys: ["locations"], label: "🗺️ Locations", block: true },
  {
    keys: ["spawn_location", "spawn location"],
    label: "🗺️ Spawn Location",
    block: true
  },

  // ── Item (ItemTemplate) ────────────────────────────────────
  { keys: ["buff"], label: "✨ Buff", block: true },
  { keys: ["buff strength", "buffstrength"], label: "💪 Buff Strength" },
  { keys: ["value"], label: "💰 Value" },
  { keys: ["stack"], label: "📚 Stack Size" },
  { keys: ["usage"], label: "🛠️ Usage", block: true },
  { keys: ["stomach"], label: "🍖 Stomach" },
  { keys: ["food type"], label: "🍽️ Food Type" },
  { keys: ["habitat"], label: "🌿 Habitat" },
  { keys: ["water"], label: "💧 Water" },
  { keys: ["recipe"], label: "📜 Recipe", block: true },

  // ── Location ───────────────────────────────────────────────
  { keys: ["area"], label: "🗺️ Area" },

  // ── Faction ────────────────────────────────────────────────
  { keys: ["leader"], label: "👑 Leader" },
  { keys: ["major_npc", "major npc"], label: "👤 Major NPC" },
  { keys: ["goals"], label: "🎯 Goals", block: true },
  { keys: ["territory"], label: "🗺️ Territory", block: true },
  { keys: ["subunits"], label: "🏛️ Subunits", block: true },
  { keys: ["founded"], label: "📅 Founded" },
  { keys: ["dissolved"], label: "📅 Dissolved" },
  { keys: ["reorganized"], label: "📅 Reorganized" },

  // ── Aspect ─────────────────────────────────────────────────
  { keys: ["appearance"], label: "👤 Appearance", block: true },
  {
    keys: ["obtained_by", "obtained by"],
    label: "🎯 Obtained By",
    block: true
  },
  { keys: ["traits"], label: "✨ Traits", block: true },

  // ── Block-style extras ─────────────────────────────────────
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
    if (line.startsWith("*") || line.startsWith("#")) {
      let content = line;
      while (content.startsWith("*") || content.startsWith("#")) {
        content = content.slice(1).trim();
      }
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
    opt.setName("name").setDescription("What to look up").setRequired(true)
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
        { name: "Oath", value: "oath" },
        { name: "Enchantment", value: "enchant" },
        { name: "Equipment", value: "equip" },
        { name: "Outfit", value: "outfit" },
        { name: "Enemy", value: "enemy" },
        { name: "Monster", value: "monster" },
        { name: "NPC", value: "npc" },
        { name: "Item", value: "item" },
        { name: "Tool", value: "tool" },
        { name: "Location", value: "location" },
        { name: "Character", value: "character" },
        { name: "Faction", value: "faction" },
        { name: "Aspect", value: "aspect" }
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
  const itemName = getField(info, ["name", "npcname", "title1", "title"]);
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

  if (info.__image_url) {
    embed.setThumbnail(info.__image_url);
  }

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
    if (/^[\s.\-–—…,;:]+$/.test(value)) continue;
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
    if (key.startsWith("_")) continue;

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
