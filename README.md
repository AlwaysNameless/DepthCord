# DepthCord

Discord bot for Lost in the Voidsea. Wiki lookups, event scheduling, and a guild registry.

## What it does

**Wiki.** Type a name, get the wiki entry. Mantras, weapons, talents, oaths, enchantments, gear, outfits, enemies, monsters, NPCs, items, tools, locations, characters, factions, aspects. It figures out what you're asking for on its own. If it guesses wrong, you can pass a `type:` to force it.

**Events.** Make an event, people join or leave with buttons, roster is tracked per event. There's a scheduler that posts a reminder before it starts.

**Registry.** Keeps track of who's an ally, who's an enemy, and who's a ganker. Each entry has a reason attached. Autocomplete on lookup so you don't have to remember exact names.

## Requirements

- Node.js v22 or newer
- A Discord app with a bot user
- Message Content intent enabled in the dev portal

## Setup

Install deps:

    npm install

Make a `.env` in the root:

    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_application_id
    GUILD_ID=your_server_id
    EVENT_CHANNEL_ID=optional_reminder_channel

First three are required. The fourth is optional, turns on reminders.

Run it:

    node src/index.js

Slash commands register on startup.

## Commands

| Command | What it does |
|---------|--------------|
| `/wiki name:<query> [type:<type>]` | Look up a page on the Deepwoken wiki |
| `/event create` | Create an event with signup buttons |
| `/event list` | Show upcoming events |
| `/event delete` | Delete an event |
| `/registry add` | Add a guild to the registry |
| `/registry remove` | Remove a guild from the registry |
| `/registry list` | List registered guilds |
| `/registry view` | Show a guild's full entry |
| `/credit` | Bot credits |
| `/info` | Command list |

## Project layout

    src/
      commands/       Slash commands
      db/             SQLite stuff, schema, queries
      events/         Discord event listeners
      utils/          Embeds, wiki API, scheduler
      index.js        Entry point
    data/
      deepiscalling.db  SQLite file, made on first run

## Database

SQLite, using better-sqlite3. Schema is in `src/db/schema.sql` and gets applied on startup. Two tables:

- `events` - scheduled events, roster stored as JSON
- `registry` - guild standings

Want to reset it? Delete `data/deepiscalling.db` and restart.

## License

MIT
