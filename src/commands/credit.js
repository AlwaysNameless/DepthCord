import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("credit")
  .setDescription("The people behind DepthCord");

export async function execute(i) {
  const embed = new EmbedBuilder()
    .setTitle("⚡ DepthCord")
    .setColor(0x8b5cf6)
    .setDescription("Lost in the Voidsea's not-so-secret weapon.")
    .addFields(
      { name: "Lead Developer & Creator", value: "**Nameless**", inline: true },
      { name: "Tester (Idiot)", value: "**Hex**", inline: true },
      { name: "Tester (Broke it alot...)", value: "**Sam**", inline: true },
      { name: "The reason it exists", value: "**Lost in the Voidsea**" },
      {
        name: "💙",
        value:
          "Never played the game. Just wanted to help my brother's guild. Hope this makes things easier for all of you.\n\n— Nameless",
      },
    )
    .setFooter({ text: "DepthCord • By Nameless" })
    .setTimestamp();

  await i.reply({ embeds: [embed] });
}
