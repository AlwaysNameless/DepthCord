import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { searchWiki, getPageInfo, getField } from "../utils/wikiApi.js";

const EMBED_DESC_LIMIT = 4096;

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

function formatEffectText(raw) {
  return formatFieldText(raw) || "No description available.";
}

/**
 * Picks a readable label out of a piped wiki template like
 * {{status|b=y|ncl=y|Daze|Dazed}} or {{cl|raretlnf|Speed Demon}} —
 * skips key=value flag args and returns the last plain segment.
 */
function genericPipedLabel(inner) {
  const parts = ("x|" + inner).split("|").map((p) => p.trim());
  parts.shift();
  for (let i = parts.length - 1; i >= 0; i--) {
    if (parts[i] && !/^[a-z]+\s*=/i.test(parts[i])) {
      return parts[i];
    }
  }
  return parts[parts.length - 1] || "";
}

/**
 * Talent pages use a handful of wiki macros inside field values
 * (e.g. {{abf|prereq|[Strength]}}, {{t|Some Talent|r=rare}},
 * {{status|Burn}}, {{ttag|Fists}}, {{c|knowledge|10}}). This strips
 * those down to human-readable text. Only used on talent fields so it
 * can't affect mantra/weapon formatting.
 */
function stripWikiMacros(raw) {
  if (!raw) return raw;
  let text = raw;

  // {{sic|expected=...}} is just a wiki typo-flag annotation — drop it.
  text = text.replace(/\{\{sic\|[^{}]*\}\}/gi, "");

  // {{c|type|amount}} -> "amount type" e.g. {{c|knowledge|10}} -> "10 knowledge"
  text = text.replace(
    /\{\{c\|([^|{}]+)\|([^{}]+)\}\}/gi,
    (_m, type, amount) => `${amount.trim()} ${type.trim()}`
  );

  // {{t|Talent Name|r=rare}} -> Talent Name
  text = text.replace(/\{\{t\|([^|{}]+)[^{}]*\}\}/gi, "$1");

  // {{status|...}} / {{cl|...}} -> best-guess readable label
  text = text.replace(/\{\{(?:status|cl)\|([^{}]*)\}\}/gi, (_m, inner) =>
    genericPipedLabel(inner)
  );

  // {{ttag|Fists}} -> [Fists]
  text = text.replace(/\{\{ttag\|([^{}]+)\}\}/gi, "[$1]");

  // {{abf|prereq|[Strength]}} / {{abf|[Tool]}} -> [Strength] / [Tool]
  text = text.replace(/\{\{abf\|(?:[^|{}]*\|)?([^{}]*)\}\}/gi, "$1");

  // {{ulid|...}} / {{ulid}} section markers -> drop entirely
  text = text.replace(/\{\{ulid[^{}]*\}\}/gi, "");

  // Any leftover {{...}} wrapper -> just its inner text (last resort)
  text = text.replace(/\{\{([^{}]*)\}\}/g, "$1");

  return text.replace(/[ \t]{2,}/g, " ").trim();
}

function formatTalentText(raw, limit = EMBED_DESC_LIMIT) {
  return formatFieldText(stripWikiMacros(raw), limit);
}

export const data = new SlashCommandBuilder()
  .setName("wiki")
  .setDescription("Query the Deepwoken Fandom Wiki")
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
      .setDescription("Get details on a specific Weapon")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("Weapon name").setRequired(true)
      )
  );

export async function execute(interaction) {
  await interaction.deferReply();

  const sub = interaction.options.getSubcommand();
  const query = interaction.options.getString("name");

  let pageInfo = null;

  if (sub === "talent") {
    // Talents don't have their own pages — they're blocks on the shared
    // "Talents" page. Look the name up directly instead of trusting
    // MediaWiki's fuzzy search, which has nothing named e.g. "Brick Wall"
    // to find and will happily return an unrelated page.
    pageInfo = await getPageInfo(query, query, sub);

    if (!pageInfo || Object.keys(pageInfo.infobox).length === 0) {
      // Fallback: maybe it's a standalone-page talent, or needs
      // disambiguating via normal search.
      const searchedTitle = await searchWiki(query);
      if (searchedTitle) {
        pageInfo = await getPageInfo(searchedTitle, query, sub);
      }
    }

    if (!pageInfo) {
      return interaction.editReply(`❌ Failed to retrieve **${query}**.`);
    }
  } else {
    const title = await searchWiki(query);
    if (!title) {
      return interaction.editReply(`❌ No page found for **${query}**.`);
    }

    pageInfo = await getPageInfo(title, query, sub);
    if (!pageInfo) {
      return interaction.editReply(`❌ Failed to retrieve **${title}**.`);
    }
  }

  const info = pageInfo.infobox;
  if (Object.keys(info).length === 0) {
    return interaction.editReply(`❌ No info found for **${query}**.`);
  }

  const mantraName = getField(info, ["name"]);
  const displayTitle = pageInfo.redirect
    ? `${pageInfo.redirect} → ${mantraName || pageInfo.title}`
    : mantraName || pageInfo.title;
  const url = `https://deepwoken.fandom.com/wiki/${encodeURIComponent(
    pageInfo.title.replace(/ /g, "_")
  )}`;

  const embed = new EmbedBuilder()
    .setTitle(displayTitle)
    .setURL(url)
    .setColor(0x00aaff)
    .setFooter({ text: `DeepIsCalling • Deepwoken Wiki` });

  if (sub === "mantra") {
    const effect = getField(info, ["effect"]);
    embed.setDescription(formatEffectText(effect));

    let attunement = getField(info, ["attunement", "element"]);
    if (!attunement) {
      const reqs = getField(info, ["reqs"]);
      if (reqs) {
        const match = reqs.match(
          /\b(Thundercall|Flamecharm|Frostdraw|Galebreath|Shadowcast|Attunementless)\b/i
        );
        if (match) attunement = match[1];
      }
    }
    if (!attunement) {
      const pageTitleLower = pageInfo.title.toLowerCase();
      const attunements = [
        "thundercall",
        "flamecharm",
        "frostdraw",
        "galebreath",
        "shadowcast"
      ];
      for (const a of attunements) {
        if (pageTitleLower.includes(a)) {
          attunement = a.charAt(0).toUpperCase() + a.slice(1);
          break;
        }
      }
    }
    if (attunement) {
      embed.addFields({
        name: "✨ Attunement",
        value: attunement,
        inline: true
      });
    }

    const etherCost = getField(info, ["ethercost"]);
    if (etherCost) {
      embed.addFields({
        name: "💧 Ether Cost",
        value: etherCost,
        inline: true
      });
    }

    const reqs = getField(info, ["reqs"]);
    if (reqs) {
      embed.addFields({ name: "📊 Requirements", value: reqs, inline: true });
    }
  } else if (sub === "weapon") {
    const description = getField(info, ["description"]);
    embed.setDescription(formatEffectText(description));

    const type = getField(info, ["type"]);
    if (type) {
      embed.addFields({ name: "⚔️ Type", value: type, inline: true });
    }

    const rarity = getField(info, ["rarity"]);
    if (rarity) {
      embed.addFields({ name: "🌟 Rarity", value: rarity, inline: true });
    }

    const requirements = getField(info, ["requirements", "reqs"]);
    if (requirements) {
      embed.addFields({
        name: "📊 Requirements",
        value: requirements,
        inline: true
      });
    }

    const damage = getField(info, ["damage"]);
    const damageType = getField(info, ["damage type", "dmgtype"]);
    if (damage) {
      embed.addFields({
        name: "💥 Damage",
        value: damageType ? `${damage} (${damageType})` : damage,
        inline: true
      });
    }

    const scaling = getField(info, ["scaling"]);
    if (scaling) {
      embed.addFields({ name: "📈 Scaling", value: scaling, inline: true });
    }

    const range = getField(info, ["range"]);
    const rangeType = getField(info, ["range type"]);
    if (range) {
      embed.addFields({
        name: "📏 Range",
        value: rangeType ? `${range} (${rangeType})` : range,
        inline: true
      });
    }

    const specialEffect = getField(info, ["special effect"]);
    if (specialEffect) {
      const formatted = formatFieldText(specialEffect, 1024);
      if (formatted) {
        embed.addFields({
          name: "✨ Special Effect",
          value: formatted,
          inline: false
        });
      }
    }

    const obtainment = getField(info, ["obtainment"]);
    if (obtainment) {
      const formatted = formatFieldText(obtainment, 1024);
      if (formatted) {
        embed.addFields({
          name: "🎯 Obtainment",
          value: formatted,
          inline: false
        });
      }
    }
  } else if (sub === "talent") {
    const description = getField(info, ["description"]);
    embed.setDescription(
      formatTalentText(description) || "No description available."
    );

    const rarity = getField(info, ["rarity"]);
    if (rarity) {
      embed.addFields({ name: "🌟 Rarity", value: rarity, inline: true });
    }

    const category = getField(info, ["category"]);
    if (category && category.trim().toLowerCase() !== "unknown") {
      embed.addFields({
        name: "🗂️ Category",
        value: category.trim(),
        inline: true
      });
    }

    const stats = getField(info, ["stats"]);
    if (stats) {
      embed.addFields({
        name: "📈 Stats",
        value: formatTalentText(stats, 1024) || stats,
        inline: true
      });
    }

    const condition = getField(info, ["condition"]);
    if (condition) {
      embed.addFields({
        name: "⚙️ Condition",
        value: formatTalentText(condition, 1024) || condition,
        inline: true
      });
    }

    const requirements = getField(info, ["requirements"]);
    if (requirements) {
      const formatted = formatTalentText(requirements, 1024);
      if (formatted) {
        embed.addFields({
          name: "📊 Requirements",
          value: formatted,
          inline: false
        });
      }
    }

    const equipment = getField(info, ["equipment"]);
    if (equipment) {
      const formatted = formatTalentText(equipment, 1024);
      if (formatted) {
        embed.addFields({
          name: "🛡️ Granted By Equipment",
          value: formatted,
          inline: false
        });
      }
    }

    const tags = getField(info, ["tags"]);
    if (tags) {
      const formatted = stripWikiMacros(tags).replace(/\s+/g, " ").trim();
      if (formatted) {
        embed.addFields({
          name: "🏷️ Tags",
          value:
            formatted.length > 1024
              ? formatted.slice(0, 1000) + "…"
              : formatted,
          inline: false
        });
      }
    }

    const mutualExclusives = getField(info, ["mutual exclusives"]);
    if (mutualExclusives) {
      const formatted = formatTalentText(mutualExclusives, 1024);
      if (formatted) {
        embed.addFields({
          name: "🚫 Mutually Exclusive With",
          value: formatted,
          inline: false
        });
      }
    }

    const additionalInfo = getField(info, ["additional info"]);
    if (additionalInfo) {
      const formatted = formatTalentText(additionalInfo, 1024);
      if (formatted) {
        embed.addFields({
          name: "📝 Additional Info",
          value: formatted,
          inline: false
        });
      }
    }
  }

  return interaction.editReply({ embeds: [embed] });
}
