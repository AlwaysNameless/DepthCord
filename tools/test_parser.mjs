import fs from "node:fs";
import readline from "node:readline";

const file = "wiki_dump/pages.jsonl";
const stream = fs.createReadStream(file);
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

const KNOWN = [
  "MantraInfobox",
  "TalentInfo/Talents",
  "Weapon_Infobox",
  "WeaponInfobox",
  "Weapon Infobox",
  "Oath",
  "Relic"
];

const CONTENT_MISSING = [
  "EquipInfobox",
  "ItemTemplate",
  "EnemyInfobox",
  "OutfitInfobox",
  "Location",
  "NPCInfobox",
  "ToolInfobox",
  "Monster Infobox",
  "Aspect",
  "Factions",
  "Basic Infobox",
  "Character"
];

const META = [
  "PathfinderEx",
  "Topbuttons",
  "Quotes",
  "IronVowEx",
  "cnp",
  "Cnp",
  "CutContent",
  "Stub",
  "stub",
  "InProgress",
  "Leak",
  "leak",
  "SpecContent",
  "EventContent",
  "DISPLAYTITLE",
  "gaa",
  "NonCanon",
  "Outdated",
  "Cleanup",
  "Merchandise",
  "Disambiguation",
  "Spoiler",
  "VersionTopNav",
  "Event",
  "Conjecture",
  "lsw",
  "Set",
  "set",
  "AllElementalWeapons",
  "AllRifleWeapons",
  "AllOffhandWeapons",
  "AllMediumWeapons"
];

const stats = {
  total: 0,
  redirect: 0,
  stub: 0,
  handled: 0,
  missing: {},
  meta: 0,
  prose: 0,
  proseSamples: []
};

function hasTemplate(wikitext, name) {
  return wikitext.includes(`{{${name}`) || wikitext.includes(`{{ ${name}`);
}

for await (const line of rl) {
  if (!line.trim()) continue;

  let page;
  try {
    page = JSON.parse(line);
  } catch {
    continue;
  }

  stats.total++;
  const wt = page.wikitext;

  if (/^#redirect/i.test(wt.trim())) {
    stats.redirect++;
    continue;
  }

  if (wt.trim().length < 100) {
    stats.stub++;
    continue;
  }

  if (KNOWN.some((t) => hasTemplate(wt, t))) {
    stats.handled++;
    continue;
  }

  const missing = CONTENT_MISSING.find((t) => hasTemplate(wt, t));
  if (missing) {
    stats.missing[missing] = (stats.missing[missing] || 0) + 1;
    continue;
  }

  if (META.some((t) => hasTemplate(wt, t))) {
    stats.meta++;
    continue;
  }

  stats.prose++;
  if (stats.proseSamples.length < 15) {
    const firstLine = wt.split("\n").find((l) => l.trim()) || "";
    stats.proseSamples.push({
      title: page.title,
      firstLine: firstLine.slice(0, 100)
    });
  }
}

console.log("=== Coverage ===");
console.log(`Total pages:         ${stats.total}`);
console.log(`Redirects:           ${stats.redirect}`);
console.log(`Stubs:               ${stats.stub}`);
console.log(`Handled:             ${stats.handled}`);
console.log(
  `Missing extractor:   ${Object.values(stats.missing).reduce((a, b) => a + b, 0)}`
);
console.log(`Meta markers only:   ${stats.meta}`);
console.log(`Prose / no template: ${stats.prose}`);
console.log();

const relevant =
  stats.total - stats.redirect - stats.stub - stats.meta - stats.prose;
console.log(
  `Content coverage: ${stats.handled}/${relevant} = ${((stats.handled / relevant) * 100).toFixed(1)}%`
);
console.log();

console.log("=== Missing extractors (priority order) ===");
for (const [t, count] of Object.entries(stats.missing).sort(
  (a, b) => b[1] - a[1]
)) {
  console.log(`  ${t}: ${count}`);
}
console.log();

console.log("=== Remaining prose pages (first 15) ===");
for (const s of stats.proseSamples) {
  console.log(`  ${s.title}`);
  console.log(`    ${s.firstLine}`);
}
