import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("event")
  .setDescription("Manage guild events");

export async function execute(interaction) {
  await interaction.reply({
    content: "Event command placeholder.",
    ephemeral: true
  });
}
