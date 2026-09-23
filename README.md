# DepthCord

Discord bot for the Deepwoken guild Lost in the Voidsea. Wiki lookups, event scheduling with signups, and a diplomatic registry.

## What it does

**Wiki lookup.** Query anything on the Deepwoken Fandom wiki. Mantras, weapons, talents, oaths, enchantments, equipment, outfits, enemies, monsters, NPCs, items, tools, locations, characters, factions, aspects. The bot auto-detects the content type, or you can pass a `type:` to narrow it down.

**Events.** Create, list, and delete scheduled events. People join and leave with buttons, and the roster is tracked per event.

**Registry.** Track guild standings (ally, enemy, ganker) with a reason for each. Autocomplete on name lookup.

**Scheduler.** Posts a reminder in a configured channel before an event starts.

**Control channel.** A private channel where a local dashboard can pair with the bot and issue commands.

## Requirements

- Node.js v22 or later
- A Discord application with a bot user
- Message Content intent enabled in the Discord developer portal

## Setup

Clone the repo and install:

    npm install

Create a `.env` in the project root:

    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_application_id
    GUILD_ID=your_server_id
    EVENT_CHANNEL_ID=optional_reminder_channel
    CONTROL_CHANNEL_ID=optional_control_channel
    DASHBOARD_BOT_ID=optional_dashboard_bot_id

Only the first three are required. `EVENT_CHANNEL_ID` turns on reminders. `CONTROL_CHANNEL_ID` and `DASHBOARD_BOT_ID` turn on the control channel.

Start it:

    node src/index.js

Slash commands register on startup.

## Commands

| Command | Description |
|---------|-------------|
| `/wiki name:<query> [type:<type>]` | Look up a page on the Deepwoken wiki |
| `/event create` | Create an event with signup buttons |
| `/event list` | List upcoming events |
| `/event delete` | Delete an event by ID |
| `/registry add` | Add a guild to the registry |
| `/registry remove` | Remove a guild from the registry |
| `/registry list` | List registered guilds |
| `/registry view` | View a guild's full registry entry |
| `/credit` | Bot credits |
| `/info` | Command list |

## Project structure

    src/
      commands/       Slash command definitions
      control/        Control channel logic
      db/             SQLite database, schema, queries
      events/         Discord event listeners
      utils/          Helpers (embeds, wiki API, scheduler)
      index.js        Entry point
    data/
      deepiscalling.db  SQLite database, created on first run

## Database

SQLite through better-sqlite3. The schema lives in `src/db/schema.sql` and is applied on startup. Tables:

- `events` - scheduled events, roster stored as JSON
- `registry` - diplomatic standings
- `paired_tools` - control channel pairing state

To reset the database, delete `data/deepiscalling.db` and restart.

## License

ISC
