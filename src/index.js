import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client, GatewayIntentBits, Collection } from "discord.js";
import dotenv from "dotenv";
import ready from "./events/ready.js";
import { startScheduler } from "./utils/scheduler.js";

dotenv.config();

const dir = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const cmdDir = path.join(dir, "commands");

if (fs.existsSync(cmdDir)) {
  const files = fs.readdirSync(cmdDir).filter((f) => f.endsWith(".js"));

  for (const file of files) {
    const full = path.join(cmdDir, file);
    const cmd = await import(pathToFileURL(full).href);

    if (cmd.data && cmd.execute) {
      client.commands.set(cmd.data.name, cmd);
    } else {
      console.warn(`[WARNING] ${full} missing "data" or "execute"`);
    }
  }
}

client.on("interactionCreate", async (i) => {
  try {
    if (i.isAutocomplete()) {
      const cmd = client.commands.get(i.commandName);
      if (cmd?.autocomplete) {
        try {
          await cmd.autocomplete(i);
        } catch (e) {
          console.error(`Autocomplete error for ${i.commandName}:`, e);
        }
      }
      return;
    }

    if (i.isButton()) {
      const cmd = client.commands.get("event");
      if (cmd?.handleButton) {
        try {
          await cmd.handleButton(i);
        } catch (e) {
          console.error("Button handler error:", e);
          if (!i.replied) {
            await i.reply({
              content: "There was an error processing this button.",
              flags: 64,
            });
          }
        }
      }
      return;
    }

    if (i.isStringSelectMenu()) return;

    if (i.isChatInputCommand()) {
      const cmd = client.commands.get(i.commandName);

      if (!cmd) {
        return i.reply({ content: "❌ Command not found.", flags: 64 });
      }

      try {
        await cmd.execute(i);
      } catch (e) {
        console.error(`Error executing ${i.commandName}:`, e);
        const msg = "There was an error executing this command.";
        if (i.replied || i.deferred) {
          await i.followUp({ content: msg, flags: 64 });
        } else {
          await i.reply({ content: msg, flags: 64 });
        }
      }
    }
  } catch (e) {
    console.error("Unhandled interaction error:", e);
  }
});

client.on("messageCreate", (m) => {
  if (m.author.bot || m.content !== "!ping") return;
  m.reply("pong");
});

client.once("ready", (c) => {
  ready(c);
  startScheduler(c);
});

client.login(process.env.DISCORD_TOKEN);
