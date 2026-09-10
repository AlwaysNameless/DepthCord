# DepthCord – Reference

## Overview

Discord.js v14 bot for Lost in the Voidsea. Node.js v22, SQLite, ES Modules.

Features: wiki lookup, event scheduling with buttons, diplomatic registry.

## File Map

src/index.js – entry point, loads commands, routes interactions, starts scheduler
src/commands/ – one file per slash command
credit.js – credits
info.js – command list
event.js – create/list/delete + join/leave/view buttons
registry.js – add/remove/list/view + autocomplete
wiki.js – lookup + embed display
src/db/index.js – SQLite connection
src/db/schema.sql – table definitions
src/db/queries/events.js – event CRUD
src/db/queries/registry.js – registry CRUD
src/events/ready.js – command registration
src/utils/embedBuilder.js – embed factory (createEmbed, errorEmbed, successEmbed)
src/utils/scheduler.js – event reminder loop
src/utils/wikiApi.js – Fandom API fetch + wikitext parsing

## Environment Variables

DISCORD_TOKEN – bot token
CLIENT_ID – application ID
GUILD_ID – server for slash registration
EVENT_CHANNEL_ID – optional reminder channel

Local .env must use a test server GUILD_ID. Never production.

## Commands

Every command file exports:
export const data = new SlashCommandBuilder()...
export async function execute(interaction) {...}
export async function autocomplete(interaction) {...} // optional
export async function handleButton(interaction) {...} // optional

index.js scans src/commands/, registers data.name, routes interactions.

## Wiki Flow

/wiki name:X type:Y
-> searchWiki(X) returns best page title or null
-> getPageInfo(pageTitle, X, Y) returns { title, infobox, source }
-> buildAndSendEmbed() renders embed

searchWiki prefers exact title, falls back only if the top fuzzy result shares a word with the query.

getPageInfo tries in order:

1. If kind=oath: fetch "Oath: X" then X
2. If kind=talent: scan "Talents" page for {{TalentInfo/Talents}} block
3. If kind not talent: untyped sweep of "Talents", then "Oath: X"
4. Fetch item's own page: kind-specific extractor, then any infobox

Extractors in wikiApi.js:
extractTalentBlock – {{TalentInfo/Talents}} blocks matched by name=
extractUlidTalent – {{ulid|Name}} fallback
extractMantraBlock – {{MantraInfobox}} matched by |name=
extractNamedInfobox – scans every {{ on every line for a template name
extractOathBlock – shorthand for extractNamedInfobox(..., ["Oath"])
extractAnyInfobox – first template with "infobox" in its name

Parsers:
parseTalentBlock – top-level pipe split
parseInfoboxBlock – line-based key/value with continuation
cleanWikiValue – strips stats/status/cl/t/abf macros, links, HTML, italics

Display rules in wiki.js:
TITLE_OR_DESC_FIELDS – shown as title/description, not as fields
HIDDEN_FIELDS – never shown
FIELD_DISPLAY – ordered list of { keys, label, block }
Fallback: unused keys render as "<?>" Label

To add a field: append to FIELD_DISPLAY.
To hide a field: add key to HIDDEN_FIELDS.

## Events Flow

Slash: create, list, delete. Buttons: event*join*<id>, event*leave*<id>, event*view*<id>.
Routed via handleButton in event.js.

Storage: events table, roster_json is a JSON array of user IDs.
Time: any string accepted, stored raw in time_raw. scheduled_start is a placeholder for sorting.

Permissions: ALLOWED_ROLES in event.js. Any listed role can create/delete.

## Registry Flow

Slash: add, remove, list, view.
Autocomplete on remove and view pulls from listTargets("all").
Alignments: ally, enemy, ganker. Type is always "guild".

Permissions: ALLOWED_ROLES in registry.js gates add and remove only.

## Database

Tables: events, registry. See src/db/schema.sql.

Reset:
sqlite3 data/deepiscalling.db "DROP TABLE events; DROP TABLE registry;"
Restart bot to recreate.

## Errors

10062 Unknown interaction – two bot instances running in the same guild
40060 Interaction already acknowledged – same cause, or duplicate deferReply
Missing Access – bot not in guild, or wrong GUILD_ID
table has no column – schema changed, drop and restart
Cannot open database – missing data/ folder on host

## Discord.js Essentials

Responding:
await interaction.reply(...) one-shot
await interaction.deferReply() use before slow work
await interaction.editReply(...) after defer
await interaction.followUp(...) after already replied

Never mix reply and editReply without checking interaction.replied / interaction.deferred.

Ephemeral: use flags: 64, not ephemeral: true.

Button update: await interaction.update({ embeds, components }).

Command option types: addStringOption, addIntegerOption, addBooleanOption,
addUserOption, addChannelOption, addRoleOption, addAttachmentOption.

Subcommands: .addSubcommand(sub => ...), read with interaction.options.getSubcommand().

Roles check: interaction.member.roles.cache.some(r => ALLOWED.includes(r.id)).

## Git

Branches: main = production (Wispbyte auto-pull), dev = local work.
Test locally with a test server GUILD_ID. Never local + production in same guild.
