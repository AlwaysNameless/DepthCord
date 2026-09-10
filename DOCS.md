# DepthCord – Developer Documentation

## 1. Project Overview

DepthCord is a Discord.js v14 bot for Lost in the Voidsea. Features:

- Wiki lookup (/wiki) — Mantras, weapons, talents, oaths from the Deepwoken Fandom wiki
- Events (/event) — Create events with join/leave buttons, roster tracking
- Registry (/registry) — Diplomatic standings (Ally / Enemy / Ganker)
- Credit / Info (/credit, /info) — Metadata commands

Stack: Node.js v22 · Discord.js v14 · better-sqlite3 · ES Modules

---

## 2. File Structure

DepthCord/
├── src/
│ ├── commands/
│ │ ├── credit.js
│ │ ├── info.js
│ │ ├── event.js # Slash + button handler
│ │ ├── registry.js # Slash + autocomplete
│ │ └── wiki.js # Slash + display
│ ├── db/
│ │ ├── index.js # SQLite connection
│ │ ├── schema.sql # Tables
│ │ └── queries/
│ │ ├── events.js
│ │ └── registry.js
│ ├── events/
│ │ └── ready.js
│ ├── utils/
│ │ ├── embedBuilder.js
│ │ ├── scheduler.js
│ │ └── wikiApi.js # Fandom API + parsing
│ └── index.js # Entry point
├── data/ # SQLite DB (gitignored)
├── .env # Secrets (gitignored)
└── package.json

---

## 3. Environment Variables

| Variable         | Required | Purpose                          |
| ---------------- | -------- | -------------------------------- |
| DISCORD_TOKEN    | Yes      | Bot token                        |
| CLIENT_ID        | Yes      | Application ID                   |
| GUILD_ID         | Yes      | Server ID for slash registration |
| EVENT_CHANNEL_ID | No       | Channel for event reminders      |

Local .env should use a test server ID — never production. Same bot token is fine; different guild means commands register separately.

---

## 4. How Commands Work

Every file in src/commands/ exports:

    export const data = new SlashCommandBuilder()
      .setName("cmd")
      .setDescription("...");

    export async function execute(interaction) { /* ... */ }

    // Optional:
    export async function autocomplete(interaction) { /* ... */ }
    export async function handleButton(interaction) { /* ... */ }

The loader in src/index.js scans the folder and registers data.name → module. execute, autocomplete, and handleButton are routed automatically.

---

## 5. Wiki Command — Detailed

Flow:

    User runs /wiki name:X type:Y
           |
           v
      searchWiki(X) -----> Fandom search API -> best page title or null
           |
           v
      getPageInfo(pageTitle, X, Y) ----> returns { title, infobox, source }
           |
           v
      buildAndSendEmbed(interaction, pageInfo, info)

searchWiki(query) (wikiApi.js):

- Calls Fandom's search API
- Prefers exact title match
- Falls back to top result only if it shares a word with the query
- Returns null otherwise — prevents "Mirage Clone" resolving to "Authority Lieutenant"

getPageInfo(title, searchQuery, kind) (wikiApi.js) tries candidates in order:

1. If kind = "oath" — try "Oath: <searchQuery>" then "<searchQuery>"
2. If kind = "talent" — scan the master Talents page for a {{TalentInfo/Talents}} block
3. If kind != "talent" — scan Talents anyway (untyped sweep), then try "Oath: <query>"
4. Fetch the item's own page — try the kind-specific extractor, then any infobox

Extractors:

| Function            | What it does                                              |
| ------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| extractTalentBlock  | Scans for {{TalentInfo/Talents                            | ...}} blocks, matches by name=                                |
| extractUlidTalent   | Finds {{ulid                                              | Name}} sections as fallback for talents with no infobox block |
| extractMantraBlock  | Finds {{MantraInfobox}} blocks by scanning for            | name= line, walks back to opener                              |
| extractNamedInfobox | Scans every {{ on every line for a matching template name |
| extractOathBlock    | Shorthand for extractNamedInfobox(wikitext, ["Oath"])     |
| extractAnyInfobox   | Fallback: first template whose name contains "infobox"    |

Critical helper: findBlockEndFromIndex(lines, startLineIdx, startCharIdx) — counts braces starting from a specific offset within a line, so multi-template lines like {{Quotes}}...{{Weapon Infobox}} extract correctly.

Parsers:

| Function          | Input          | Used for                                                 |
| ----------------- | -------------- | -------------------------------------------------------- | -------------------------------------- |
| parseTalentBlock  | Raw block text | {{TalentInfo/Talents                                     | ...}} — splits on top-level pipes only |
| parseInfoboxBlock | Raw block text | Everything else — line-based key/value with continuation |

Both run values through cleanWikiValue() which strips:

- {{stats|...}} -> last arg
- {{status|...}}, {{cl|...}} -> last non key=value segment
- {{t|Name}} -> Name
- {{abf|[Tag]}} -> [Tag]
- [[File:...]] and inline File:... -> removed
- [[Link|Display]] -> Display
- ''italics'', <tags> -> stripped
- Leftover {{...}} -> removed

Display (wiki.js):

- Title: info.name / info.title1 / info.title or page title
- Description: info.description / info.effect / info.desc
- Fields: iterates FIELD_DISPLAY, pulls values by alias list
- Fallback fields: any keys not covered by FIELD_DISPLAY shown as "<?>" <Label>
- Skipped keys: TITLE_OR_DESC_FIELDS and HIDDEN_FIELDS sets

To add a new field, add an entry to FIELD_DISPLAY:

    { keys: ["my_field", "myfield"], label: "My Field", block: true }

block: true = full-width display. Default is inline.

---

## 6. Events Command — Detailed

- Slash subcommands: create, list, delete
- Buttons: event*join*<id>, event*leave*<id>, event*view*<id>
- Routed via handleButton in event.js, called from index.js

Storage: SQLite table events with roster_json as a JSON array of user IDs.

Time: accepts any string (whenever, tomorrow 8pm, in 2 hours) — stored raw in time_raw, never parsed. scheduled_start is a placeholder timestamp (now + 1 hour) for sorting.

Permissions: ALLOWED_ROLES array in event.js — any user with one of those role IDs can create/delete.

To add an event type, edit the .addChoices(...) in the create subcommand.

---

## 7. Registry Command — Detailed

- Slash subcommands: add, remove, list, view
- Autocomplete on remove and view — pulls from listTargets("all")
- Alignments: ally, enemy, ganker (not neutral)
- Type: always "guild" — no player type

Permissions: ALLOWED_ROLES in registry.js gates add and remove only. list and view are public.

Storage: SQLite table registry. name is unique and lowercased on write.

---

## 8. Database

Schema (src/db/schema.sql):

    CREATE TABLE events (
      event_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      event_type TEXT NOT NULL,
      scheduled_start INTEGER NOT NULL,
      time_raw TEXT,
      discord_event_id TEXT,
      roster_json TEXT
    );

    CREATE TABLE registry (
      entity_id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL,
      alignment TEXT NOT NULL,
      reason TEXT,
      added_by TEXT,
      proof_url TEXT,
      created_at INTEGER
    );

Reset DB:

    sqlite3 data/deepiscalling.db "DROP TABLE events; DROP TABLE registry;"

Restart the bot to recreate.

---

## 9. Debugging

Enable Wiki Debug Logs — wikiApi.js has console.log prefixes:

- [searchWiki] — query, top result, whether it shares a word
- [getPageInfo] — args, page fetches, which extractor fired
- [extractTalentBlock] — search target, candidate count, closest names on failure
- [extractUlidTalent] — ulid marker position and parse status

Pipe to a file:

    node src/index.js 2>&1 | tee bot.log

Common Errors:

| Error                                                     | Cause                                                      | Fix                            |
| --------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------ |
| 10062 Unknown interaction                                 | Two bot instances running (Wispbyte + local) in same guild | Use a test server, or stop one |
| 40060 Interaction already acknowledged                    | Same as above, or duplicated deferReply                    | Same fix                       |
| Missing Access on slash registration                      | Bot not in the guild, or wrong GUILD_ID                    | Invite bot to the right server |
| GLIBC_2.33 not found                                      | Old Node on host                                           | Switch Node version to v22     |
| Cannot open database because the directory does not exist | Missing data/ folder                                       | mkdir data on the host         |
| table X has no column named Y                             | Schema changed, old DB                                     | Drop table, restart            |

---

## 10. Git Workflow

| Branch | Purpose    | Deploys                  |
| ------ | ---------- | ------------------------ |
| main   | Production | Yes (Wispbyte auto-pull) |
| dev    | Local work | No                       |

Local testing:

1. git checkout dev
2. Set local .env GUILD_ID to a test server
3. node src/index.js
4. Commands register in test server only
5. Push to dev, open PR, merge to main

Never: run locally with production GUILD_ID while Wispbyte is running. That's what causes 10062 and 40060.

---

## 11. Adding a New Wiki Content Type

Example: adding NPC support.

1. In wikiApi.js — add an extractor:

   function extractNPCBlock(wikitext) {
   return extractNamedInfobox(wikitext, ["NPC_Infobox", "NPCInfobox", "NPC Infobox"]);
   }

2. In getPageInfo — add a branch:

   if (kind === "npc") {
   const result = await getPageWikitext(title);
   if (result) {
   const block = extractNPCBlock(result.wikitext);
   if (block) {
   const data = parseInfoboxBlock(block);
   if (Object.keys(data).length > 0) {
   return { title: result.title, infobox: data, source: "npc-infobox", redirect: result.redirectTarget };
   }
   }
   }
   }

3. In wiki.js — add the choice:

   .addChoices(
   { name: "Mantra", value: "mantra" },
   { name: "Weapon", value: "weapon" },
   { name: "Talent", value: "talent" },
   { name: "Oath", value: "oath" },
   { name: "NPC", value: "npc" }
   )

4. In wiki.js — add any new fields to FIELD_DISPLAY:

   { keys: ["health"], label: "Health" },
   { keys: ["drops"], label: "Drops", block: true }

5. Restart and test.

---

## 12. Common Tasks Cheatsheet

| Task                          | Where                     | What to do                              |
| ----------------------------- | ------------------------- | --------------------------------------- |
| Add a field to wiki embeds    | wiki.js                   | Add to FIELD_DISPLAY                    |
| Hide a field                  | wiki.js                   | Add key to HIDDEN_FIELDS                |
| Change embed color            | wiki.js / embedBuilder.js | Update 0x00aaff                         |
| Add an event type             | event.js                  | Add .addChoices(...) entry              |
| Add a role to registry access | registry.js               | Add role ID to ALLOWED_ROLES            |
| Change default footer         | embedBuilder.js           | Edit footer default                     |
| Disable scheduler             | index.js                  | Comment out startScheduler(c)           |
| Add a new slash command       | src/commands/             | Create file with data + execute exports |

---

## 13. Fandom API Notes

- Base URL: https://deepwoken.fandom.com/api.php
- Search: action=query&list=search&srsearch=<query>
- Wikitext: action=query&prop=revisions&titles=<title>&rvprop=content&rvslots=main
- Redirects: inprop=redirect — the fetcher follows them manually
- Rate limits: Shared IPs (free hosts) hit 429 Too Many Requests often. If this happens repeatedly, consider caching responses or moving to a dedicated IP.

Wikitext quirks:

- Templates can share a line ({{Quotes}}...{{Infobox}}) — always scan every {{
- Blocks can span many lines with nested {{...}} — always count braces
- Field values can contain pipes inside nested templates — always split on top-level pipes

---

## 14. Discord.js Basics You'll Need

Client — the bot connection:

    const client = new Client({ intents: [GatewayIntentBits.Guilds] });

Interaction — what the user did. Check the type:

    if (interaction.isChatInputCommand()) { ... }
    if (interaction.isAutocomplete()) { ... }
    if (interaction.isButton()) { ... }

Responding to a slash command:

    await interaction.reply("text");              // immediate, one-shot
    await interaction.deferReply();               // "thinking..." (use before slow work)
    await interaction.editReply("text");          // after deferReply, replaces "thinking..."

If you did deferReply, ALL later responses must be editReply or followUp. Never mix reply and editReply.

Ephemeral (private) replies — use flags, not ephemeral:

    await interaction.reply({ content: "...", flags: 64 });

Updating a message in place (button clicks):

    await interaction.update({ content: "...", components: [...] });

Building an embed:

    const embed = new EmbedBuilder()
      .setTitle("...")
      .setDescription("...")
      .setColor(0x00aaff)
      .addFields({ name: "Field", value: "Value", inline: true })
      .setFooter({ text: "..." })
      .setTimestamp();

Building buttons:

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("my_button").setLabel("Click").setStyle(ButtonStyle.Primary)
    );

Sending options:

    await interaction.reply({ embeds: [embed], components: [row], flags: 64 });

Autocomplete handler:

    export async function autocomplete(interaction) {
      const focused = interaction.options.getFocused();
      const filtered = list.filter(x => x.startsWith(focused)).slice(0, 25);
      await interaction.respond(filtered.map(x => ({ name: x, value: x })));
    }

Slash command option types:

- addStringOption — text
- addIntegerOption — whole number
- addBooleanOption — true/false
- addUserOption — @user
- addChannelOption — #channel
- addRoleOption — @role
- addAttachmentOption — file upload

Subcommands (like /event create):

    .addSubcommand(sub => sub.setName("create").setDescription("...").addStringOption(...))

Reading the subcommand in execute:

    const sub = interaction.options.getSubcommand();

Roles check:

    const hasRole = interaction.member.roles.cache.some(r => ALLOWED_ROLES.includes(r.id));

Permissions check (built-in):

    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

Errors — always wrap execute in try/catch:

    try { await interaction.reply("..."); }
    catch (err) { console.error(err); }

Common gotcha: if the interaction was already replied/deferred, use followUp:

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: "...", flags: 64 });
    } else {
      await interaction.reply({ content: "...", flags: 64 });
    }

---

## 15. Git Basics You'll Need

Check status:

    git status

Pull latest from remote:

    git pull

Switch branch:

    git checkout dev
    git checkout main

Create a new branch:

    git checkout -b my-branch

Stage changes:

    git add .                    # everything
    git add src/commands/wiki.js # single file

Commit:

    git commit -m "fix: description of change"

Push:

    git push                     # if branch already has an upstream
    git push -u origin my-branch # first push of a new branch

See recent commits:

    git log --oneline -10

Undo unstaged changes to a file:

    git checkout -- src/commands/wiki.js

Undo the last commit (keep changes staged):

    git reset --soft HEAD~1

Undo the last commit (discard changes — dangerous):

    git reset --hard HEAD~1

Pull a specific file from another branch:

    git checkout main -- src/commands/wiki.js

See what's different from main:

    git diff main -- src/

---

Save this as DOCS.md in the repo root. Any time you hit an issue, search the section headers.
