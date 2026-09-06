import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes
} from "discord.js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
client.commands = new Collection();

// Load Commands
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const cmd = await import(pathToFileURL(filePath).href);
    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
    } else {
      console.warn(
        `[WARNING] Command at ${filePath} missing required "data" or "execute".`
      );
    }
  }
}

// Client Ready & Command Registration
client.once("clientReady", async () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);

  const commandsData = Array.from(client.commands.values()).map((c) =>
    c.data.toJSON()
  );
  if (commandsData.length === 0) {
    console.log("No valid commands found to register.");
    return;
  }

  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(
      `Started refreshing ${commandsData.length} application (/) commands.`
    );
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commandsData }
    );
    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error("Failed to register slash commands:", error);
  }
});

// Interaction Router
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const cmd = client.commands.get(interaction.commandName);
  if (cmd) {
    try {
      await cmd.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
