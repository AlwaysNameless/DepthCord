import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("registry")
  .setDescription("Manage guild standings");

export async function execute(interaction) {
  await interaction.reply({
    content: "Registry command placeholder.",
    ephemeral: true
  });
}
