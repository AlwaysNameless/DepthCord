// src/commands/info.js
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("info")
  .setDescription("Bot information and stats");

export async function execute(interaction) {
  const client = interaction.client;
  const guild = interaction.guild;

  const totalCommands = client.commands.size;
  const totalUsers = client.users.cache.size;
  const totalGuilds = client.guilds.cache.size;
  const uptime = formatUptime(client.uptime);

  const embed = new EmbedBuilder()
    .setTitle("⚡ DepthCord")
    .setColor(0x8b5cf6)
    .setDescription("Lost in the Voidsea's not-so-secret weapon.")
    .addFields(
      {
        name: "📊 Stats",
        value: [
          `**Commands:** ${totalCommands}`,
          `**Users:** ${totalUsers}`,
          `**Servers:** ${totalGuilds}`,
          `**Uptime:** ${uptime}`
        ].join("\n"),
        inline: false
      },
      {
        name: "📦 Tech",
        value: ["Discord.js v14", "Node.js v22", "SQLite", "Fandom API"].join(
          "\n"
        ),
        inline: true
      },
      {
        name: "👤 Created By",
        value: "**Nameless**",
        inline: true
      },
      {
        name: "💙",
        value:
          "Never played the game. Just wanted to help my brother's guild. Hope this makes things easier for all of you.",
        inline: false
      }
    )
    .setFooter({ text: "DepthCord • By Nameless" })
    .setTimestamp();

  return interaction.reply({ embeds: [embed] });
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
