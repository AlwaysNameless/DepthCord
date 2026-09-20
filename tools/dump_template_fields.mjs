import fs from "node:fs";
import readline from "node:readline";

const TEMPLATES = [
  "EquipInfobox",
  "OutfitInfobox",
  "NPCInfobox",
  "EnemyInfobox",
  "Monster Infobox",
  "ItemTemplate",
  "ToolInfobox",
  "Location",
  "Character",
  "Factions",
  "Aspect"
];

const fieldsByTemplate = {};
for (const t of TEMPLATES) fieldsByTemplate[t] = new Set();

const rl = readline.createInterface({
  input: fs.createReadStream("wiki_dump/pages.jsonl"),
  crlfDelay: Infinity
});

function extractBlock(wikitext, templateName) {
  const idx = wikitext.indexOf(`{{${templateName}`);
  if (idx === -1) return null;

  let depth = 0;
  let i = idx;
  while (i < wikitext.length - 1) {
    if (wikitext[i] === "{" && wikitext[i + 1] === "{") {
      depth++;
      i += 2;
    } else if (wikitext[i] === "}" && wikitext[i + 1] === "}") {
      depth--;
      i += 2;
      if (depth === 0) return wikitext.slice(idx, i);
    } else {
      i++;
    }
  }
  return null;
}

for await (const line of rl) {
  if (!line.trim()) continue;
  let page;
  try {
    page = JSON.parse(line);
  } catch {
    continue;
  }
  const wt = page.wikitext;

  for (const t of TEMPLATES) {
    const block = extractBlock(wt, t);
    if (!block) continue;

    const lines = block.split("\n");
    for (const l of lines) {
      const m = l.trim().match(/^\|\s*([a-zA-Z0-9_. ]+?)\s*=/);
      if (m) fieldsByTemplate[t].add(m[1].trim().toLowerCase());
    }
  }
}

for (const t of TEMPLATES) {
  const fields = [...fieldsByTemplate[t]].sort();
  console.log(`\n=== ${t} (${fields.length} fields) ===`);
  console.log(fields.join(", "));
}
