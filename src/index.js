import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import ready from "./events/ready.js";
import { startScheduler } from "./utils/scheduler.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  if (message.content !== "!ping") return;
  message.reply("pong");
});
client.commands = new Collection();

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
        `[WARNING] Command at ${filePath} missing required "data" or "execute".`,
      );
    }
  }
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command && command.autocomplete) {
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error(
            `Autocomplete error for ${interaction.commandName}:`,
            error,
          );
        }
      }
      return;
    }

    if (interaction.isButton()) {
      const command = client.commands.get("event");
      if (command && command.handleButton) {
        try {
          await command.handleButton(interaction);
        } catch (error) {
          console.error("Button handler error:", error);
          if (!interaction.replied) {
            await interaction.reply({
              content: "There was an error processing this button.",
              flags: 64,
            });
          }
        }
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        return interaction.reply({
          content: "❌ Command not found.",
          flags: 64,
        });
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(`Error executing ${interaction.commandName}:`, error);

        const errorMsg = "There was an error executing this command.";
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMsg, flags: 64 });
        } else {
          await interaction.reply({ content: errorMsg, flags: 64 });
        }
      }
      return;
    }
  } catch (err) {
    console.error("Unhandled interaction error:", err);
  }
});

client.once("ready", (c) => {
  ready(c);
  startScheduler(c);
});

client.login(process.env.DISCORD_TOKEN);
