import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Show all available commands");

export async function execute(i) {
  let list = "";

  for (const [name, cmd] of i.client.commands) {
    list += `**/${name}** – ${cmd.data?.description || "No description"}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle("⚡ DepthCord – Commands")
    .setColor(0x8b5cf6)
    .setDescription(list || "No commands found.")
    .setFooter({ text: "DepthCord • By Nameless" })
    .setTimestamp();

  await i.reply({ embeds: [embed] });
}
