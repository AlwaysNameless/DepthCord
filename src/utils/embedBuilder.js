import { EmbedBuilder } from "discord.js";

const DEFAULT_COLOR = 0x2b2d31;
const BRAND_COLOR = 0x00aaff;

export function createEmbed({
  title,
  description,
  color = BRAND_COLOR,
  fields = [],
  footer = "DepthCord • By Nameless",
  timestamp = true,
  url = null,
  thumbnail = null,
  image = null,
  author = null
}) {
  const embed = new EmbedBuilder().setColor(color).setFooter({ text: footer });

  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (url) embed.setURL(url);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (author) embed.setAuthor(author);
  if (timestamp) embed.setTimestamp();

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

export function errorEmbed(message) {
  return createEmbed({
    title: "❌ Error",
    description: message,
    color: 0xff4444,
    footer: "DepthCord • By Nameless"
  });
}

export function successEmbed(message) {
  return createEmbed({
    title: "✅ Success",
    description: message,
    color: 0x44ff44,
    footer: "DepthCord • By Nameless"
  });
}
