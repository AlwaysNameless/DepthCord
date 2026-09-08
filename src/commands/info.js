// src/commands/info.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Show all available commands");

export async function execute(interaction) {
  const commands = interaction.client.commands;

  let commandList = "";
  for (const [name, cmd] of commands) {
    const desc = cmd.data?.description || "No description";
    commandList += `**/${name}** – ${desc}\n`;
  }

  const embed = new EmbedBuilder()
    .setTitle("⚡ DepthCord – Commands")
    .setColor(0x8b5cf6)
    .setDescription(commandList || "No commands found.")
    .setFooter({ text: "DepthCord • By Nameless" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}
