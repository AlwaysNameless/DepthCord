import { EmbedBuilder } from "discord.js";

const DEFAULT_COLOR = 0x2b2d31;
const BRAND_COLOR = 0x00aaff;

export function createEmbed({
  title,
  description,
  color = BRAND_COLOR,
  fields = [],
  footer = "DepthCord • Deepwoken Database",
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
    title: "❌ Error"
  });
}
