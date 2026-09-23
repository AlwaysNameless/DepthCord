import { REST, Routes } from "discord.js";

export default async function ready(client) {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const body = [...client.commands.values()].map((c) => c.data.toJSON());

  if (!body.length) {
    console.log("No valid commands found to register.");
    return;
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`Started refreshing ${body.length} application (/) commands.`);
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID,
      ),
      { body },
    );
    console.log("Successfully reloaded application (/) commands.");
  } catch (err) {
    console.error("Failed to register slash commands:", err);
  }
}
