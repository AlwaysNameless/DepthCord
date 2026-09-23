import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { searchWiki, getPageInfo, getField } from "../utils/wikiApi.js";

const DESC_MAX = 4096;
const FIELD_MAX = 1024;

const TITLE_KEYS = new Set([
  "name",
  "npcname",
  "title",
  "title1",
  "description",
  "effect",
  "desc",
]);

const HIDDEN = new Set([
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
  "m equip",
]);

const FIELDS = [
  { k: ["rarity"], l: "🌟 Rarity" },
  { k: ["category"], l: "🗂️ Category" },
  { k: ["type"], l: "⚔️ Type" },
  { k: ["tier"], l: "🏆 Tier" },
  { k: ["damage"], l: "💥 Damage" },
  { k: ["damage type", "dmgtype"], l: "🩸 Damage Type" },
  { k: ["posture damage"], l: "🛡️ Posture Damage" },
  { k: ["scaling"], l: "📈 Scaling" },
  { k: ["range"], l: "📏 Range" },
  { k: ["range type"], l: "📏 Range Type" },
  { k: ["swing speed"], l: "⚡ Swing Speed" },
  { k: ["attack duration"], l: "⏱️ Attack Duration" },
  { k: ["penetration"], l: "🗡️ Penetration" },
  { k: ["endlag"], l: "⏳ Endlag" },
  { k: ["enchantable"], l: "✨ Enchantable" },
  { k: ["ethercost", "ether cost"], l: "💧 Ether Cost" },
  { k: ["cooldown"], l: "⏱️ Cooldown" },
  { k: ["droppable"], l: "📦 Droppable" },
  { k: ["pass down"], l: "🔁 Pass Down" },
  { k: ["oath_req", "oath req"], l: "📊 Oath Requirement", b: true },
  { k: ["effects"], l: "✨ Effects", b: true },
  { k: ["requirements"], l: "📊 Requirements" },
  { k: ["innate stats", "innate_stats"], l: "📈 Innate Stats", b: true },
  { k: ["innate talent", "innate tlent"], l: "🎯 Innate Talent" },
  { k: ["set"], l: "👕 Set" },
  { k: ["set name"], l: "🏷️ Set Name" },
  { k: ["set talent"], l: "⚡ Set Talent" },
  { k: ["styles"], l: "🎨 Styles" },
  { k: ["weight"], l: "⚖️ Weight" },
  { k: ["faction"], l: "🏛️ Faction" },
  { k: ["durability"], l: "🔧 Durability" },
  { k: ["resistances"], l: "🛡️ Resistances", b: true },
  { k: ["buffs"], l: "✨ Buffs", b: true },
  { k: ["talents"], l: "🎯 Talents", b: true },
  { k: ["stat_req", "stat req"], l: "📊 Stat Requirement" },
  { k: ["crafting req", "crafting_req"], l: "🔨 Crafting", b: true },
  { k: ["shirt", "shirt2", "pants"], l: "👕 Slots", b: true },
  { k: ["price", "selling price", "selling_price", "sell"], l: "💰 Price" },
  { k: ["affiliation"], l: "🏛️ Affiliation" },
  { k: ["alias"], l: "📛 Alias" },
  { k: ["aspect"], l: "✨ Aspect" },
  { k: ["species"], l: "🧬 Species" },
  { k: ["pronouns"], l: "👤 Pronouns" },
  { k: ["family"], l: "👪 Family" },
  { k: ["purpose"], l: "🎯 Purpose", b: true },
  { k: ["location", "located"], l: "📍 Location", b: true },
  { k: ["death"], l: "☠️ Death", b: true },
  { k: ["deathdate"], l: "📅 Death Date" },
  { k: ["health"], l: "❤️ Health" },
  { k: ["weapon"], l: "🗡️ Weapon" },
  { k: ["moves"], l: "⚔️ Moves", b: true },
  { k: ["attacks", "tacks"], l: "⚔️ Attacks", b: true },
  { k: ["behavior"], l: "🧠 Behavior", b: true },
  { k: ["challenges"], l: "🏆 Challenges", b: true },
  { k: ["drops"], l: "💧 Drops", b: true },
  { k: ["locations"], l: "🗺️ Locations", b: true },
  { k: ["spawn_location", "spawn location"], l: "🗺️ Spawn Location", b: true },
  { k: ["buff"], l: "✨ Buff", b: true },
  { k: ["buff strength", "buffstrength"], l: "💪 Buff Strength" },
  { k: ["value"], l: "💰 Value" },
  { k: ["stack"], l: "📚 Stack Size" },
  { k: ["usage"], l: "🛠️ Usage", b: true },
  { k: ["stomach"], l: "🍖 Stomach" },
  { k: ["food type"], l: "🍽️ Food Type" },
  { k: ["habitat"], l: "🌿 Habitat" },
  { k: ["water"], l: "💧 Water" },
  { k: ["recipe"], l: "📜 Recipe", b: true },
  { k: ["area"], l: "🗺️ Area" },
  { k: ["leader"], l: "👑 Leader" },
  { k: ["major_npc", "major npc"], l: "👤 Major NPC" },
  { k: ["goals"], l: "🎯 Goals", b: true },
  { k: ["territory"], l: "🗺️ Territory", b: true },
  { k: ["subunits"], l: "🏛️ Subunits", b: true },
  { k: ["founded"], l: "📅 Founded" },
  { k: ["dissolved"], l: "📅 Dissolved" },
  { k: ["reorganized"], l: "📅 Reorganized" },
  { k: ["appearance"], l: "👤 Appearance", b: true },
  { k: ["obtained_by", "obtained by"], l: "🎯 Obtained By", b: true },
  { k: ["traits"], l: "✨ Traits", b: true },
  { k: ["special effect"], l: "✨ Special Effect", b: true },
  { k: ["obtainment"], l: "🎯 Obtainment", b: true },
  { k: ["equipment"], l: "🛡️ Granted By Equipment", b: true },
  { k: ["tags"], l: "🏷️ Tags", b: true },
  { k: ["mutual exclusives"], l: "🚫 Mutually Exclusive With", b: true },
  { k: ["additional info"], l: "📝 Additional Info", b: true },
];

const ATTS = [
  "Thundercall",
  "Flamecharm",
  "Frostdraw",
  "Galebreath",
  "Shadowcast",
];
const ATTS_LOWER = ATTS.map((a) => a.toLowerCase());

const JUNK = /^[\s.\-–—…,;:]+$/;

function fmt(raw, max = DESC_MAX) {
  if (!raw) return null;

  const lines = raw.split("\n").map((l) => l.trim());
  const out = [];

  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith("*") || line.startsWith("#")) {
      let c = line;
      while (c.startsWith("*") || c.startsWith("#")) c = c.slice(1).trim();
      if (c) out.push(`- ${c}`);
    } else {
      out.push(line);
    }
  }

  if (!out.length) return null;

  let text = out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*:\s*$/gm, "")
    .replace(/\n{2,}/g, "\n")
    .trim();
  if (text.length > max)
    text = text.slice(0, max - 20).trim() + "\n…(truncated)";
  return text;
}

function attunement(info, title) {
  const direct = getField(info, ["attunement", "element"]);
  if (direct) return direct;

  const reqs = getField(info, ["reqs", "requirements", "oath_req"]);
  if (reqs) {
    const m = reqs.match(
      new RegExp(`\\b(${ATTS.join("|")}|Attunementless)\\b`, "i"),
    );
    if (m) return m[1];
  }

  const lower = (title || "").toLowerCase();
  const idx = ATTS_LOWER.findIndex((a) => lower.includes(a));
  return idx >= 0 ? ATTS[idx] : null;
}

const TYPES = [
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
  { name: "Aspect", value: "aspect" },
];

export const data = new SlashCommandBuilder()
  .setName("wiki")
  .setDescription("Look up anything on the Deepwoken Fandom Wiki")
  .addStringOption((o) =>
    o.setName("name").setDescription("What to look up").setRequired(true),
  )
  .addStringOption((o) =>
    o
      .setName("type")
      .setDescription("Optional: narrow the search to a specific content type")
      .addChoices(...TYPES),
  );

export async function execute(i) {
  await i.deferReply();

  const q = i.options.getString("name");
  const type = i.options.getString("type");
  const page = await searchWiki(q);

  let info = await getPageInfo(page || q, q, type);
  if (!info && type) info = await getPageInfo(page || q, q, null);

  if (!info) {
    return i.editReply(
      `❌ No info found for **${q}**${type ? ` (type: ${type})` : ""}.`,
    );
  }

  if (!Object.keys(info.infobox).length) {
    return i.editReply(`❌ No info found for **${q}**.`);
  }

  return send(i, info, info.infobox);
}

function send(i, page, info) {
  const name = getField(info, ["name", "npcname", "title1", "title"]);
  const title = page.redirect
    ? `${page.redirect} → ${name || page.title}`
    : name || page.title;
  const url = `https://deepwoken.fandom.com/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setURL(url)
    .setColor(0x00aaff)
    .setFooter({ text: "DepthCord • Deepwoken Wiki" });

  if (info.__image_url) embed.setThumbnail(info.__image_url);

  const desc = getField(info, ["description", "effect", "desc"]);
  embed.setDescription(fmt(desc) || "No description available.");

  const att = attunement(info, page.title);
  const used = new Set(["attunement", "element"]);

  if (att) embed.addFields({ name: "✨ Attunement", value: att, inline: true });

  for (const f of FIELDS) {
    const v = getField(info, f.k);
    if (!v || JUNK.test(v)) continue;
    f.k.forEach((k) => used.add(k));

    const text = f.b ? fmt(v, FIELD_MAX) : v;
    if (!text) continue;

    embed.addFields({
      name: f.l,
      value:
        text.length > FIELD_MAX ? text.slice(0, FIELD_MAX - 1) + "…" : text,
      inline: !f.b,
    });
  }

  for (const key of Object.keys(info)) {
    if (
      TITLE_KEYS.has(key) ||
      HIDDEN.has(key) ||
      used.has(key) ||
      key.startsWith("_")
    )
      continue;

    const v = info[key];
    if (!v) continue;

    const text = fmt(v, FIELD_MAX);
    if (!text) continue;

    const label = key
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    embed.addFields({
      name: `❔ ${label}`,
      value:
        text.length > FIELD_MAX ? text.slice(0, FIELD_MAX - 1) + "…" : text,
    });
  }

  return i.editReply({ embeds: [embed] });
}
