const BASE_URL = "https://deepwoken.fandom.com/api.php";

const TEMPLATE_MAP = {
  mantra: ["MantraInfobox"],
  weapon: ["Weapon_Infobox", "WeaponInfobox", "Weapon Infobox"],
  oath: ["Oath"],
  enchant: ["Relic"],
  equip: ["EquipInfobox"],
  outfit: ["OutfitInfobox"],
  npc: ["NPCInfobox"],
  enemy: ["EnemyInfobox"],
  monster: ["Monster Infobox"],
  item: ["ItemTemplate"],
  tool: ["ToolInfobox"],
  location: ["Location"],
  character: ["Character"],
  faction: ["Factions"],
  aspect: ["Aspect"],
  basic: ["Basic Infobox"]
};

export async function searchWiki(query) {
  const target = query.toLowerCase().trim();

  const directParams = new URLSearchParams({
    action: "query",
    titles: query,
    prop: "info",
    inprop: "url",
    format: "json",
    origin: "*",
    redirects: "1"
  });
  const directRes = await fetch(`${BASE_URL}?${directParams}`);
  const directData = await directRes.json();
  const directPages = directData.query?.pages || {};
  const directPageId = Object.keys(directPages)[0];
  if (directPageId && directPageId !== "-1") {
    const title = directPages[directPageId].title;
    console.log(`[searchWiki] exact page match: ${title}`);
    return title;
  }

  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*"
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  const data = await res.json();
  if (!data.query?.search?.length) return null;

  const results = data.query.search;
  const exact = results.find((r) => r.title.toLowerCase().trim() === target);
  if (exact) return exact.title;

  const top = results[0];
  const topLower = top.title.toLowerCase();
  const queryWords = target.split(/\s+/).filter((w) => w.length > 2);
  const sharesWord = queryWords.some((w) => topLower.includes(w));

  console.log(
    `[searchWiki] fuzzy: query="${target}" top="${top.title}" sharesWord=${sharesWord}`
  );

  if (sharesWord) return top.title;
  return null;
}

export async function getPageWikitext(title) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions|info",
    titles: title,
    rvprop: "content",
    rvslots: "main",
    inprop: "redirect",
    format: "json",
    origin: "*"
  });
  const res = await fetch(`${BASE_URL}?${params}`);
  const data = await res.json();
  const pages = data.query?.pages;
  if (!pages) return null;
  let pageId = Object.keys(pages)[0];
  if (pageId === "-1") return null;
  let page = pages[pageId];

  let redirectTarget = null;

  if (page.redirect && page.redirect[0]) {
    redirectTarget = page.redirect[0].to;
  } else {
    const raw = page.revisions?.[0]?.slots?.main?.["*"];
    if (raw) {
      const m = raw.trim().match(/^#redirect\s*:?\s*\[\[([^\]]+)\]\]/i);
      if (m) redirectTarget = m[1].trim();
    }
  }

  if (redirectTarget) {
    const cleanTarget = redirectTarget.split("#")[0].trim();
    console.log(
      `[getPageWikitext] following redirect: ${title} -> ${cleanTarget}`
    );
    const targetParams = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: cleanTarget,
      rvprop: "content",
      rvslots: "main",
      format: "json",
      origin: "*"
    });
    const targetRes = await fetch(`${BASE_URL}?${targetParams}`);
    const targetData = await targetRes.json();
    const targetPages = targetData.query?.pages;
    if (targetPages) {
      const targetId = Object.keys(targetPages)[0];
      if (targetId !== "-1") {
        const targetPage = targetPages[targetId];
        const content = targetPage.revisions?.[0]?.slots?.main?.["*"];
        if (content) {
          const nested = content
            .trim()
            .match(/^#redirect\s*:?\s*\[\[([^\]]+)\]\]/i);
          if (nested) {
            return getPageWikitext(nested[1].trim().split("#")[0]);
          }
          return {
            title: targetPage.title,
            wikitext: content,
            redirectTarget: cleanTarget
          };
        }
      }
    }
  }

  if (!page.revisions) return null;
  return {
    title: page.title,
    wikitext: page.revisions[0].slots.main["*"],
    redirectTarget: null
  };
}

function findBlockEnd(lines, startIdx) {
  let braceCount = 0;
  let blockEnd = -1;
  let foundEnd = false;

  for (let j = startIdx; j < lines.length; j++) {
    const currentLine = lines[j];
    for (let k = 0; k < currentLine.length; k++) {
      if (currentLine[k] === "{" && currentLine[k + 1] === "{") {
        braceCount++;
        k++;
      } else if (currentLine[k] === "}" && currentLine[k + 1] === "}") {
        braceCount--;
        k++;
        if (braceCount === 0) {
          blockEnd = j;
          foundEnd = true;
          break;
        }
      }
    }
    if (foundEnd) break;
  }

  if (blockEnd === -1) {
    blockEnd = Math.min(startIdx + 50, lines.length - 1);
  }
  return blockEnd;
}

function findBlockEndFromIndex(lines, startLineIdx, startCharIdx) {
  let braceCount = 0;
  let blockEnd = -1;
  let foundEnd = false;

  for (let j = startLineIdx; j < lines.length; j++) {
    const line = lines[j];
    const fromChar = j === startLineIdx ? startCharIdx : 0;

    for (let k = fromChar; k < line.length; k++) {
      if (line[k] === "{" && line[k + 1] === "{") {
        braceCount++;
        k++;
      } else if (line[k] === "}" && line[k + 1] === "}") {
        braceCount--;
        k++;
        if (braceCount === 0) {
          blockEnd = j;
          foundEnd = true;
          break;
        }
      }
    }
    if (foundEnd) break;
  }

  if (blockEnd === -1) {
    blockEnd = Math.min(startLineIdx + 50, lines.length - 1);
  }
  return blockEnd;
}

function splitTopLevelPipes(text) {
  const parts = [];
  let depthCurly = 0;
  let depthBracket = 0;
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === "{" && next === "{") {
      depthCurly++;
      current += "{{";
      i++;
      continue;
    }
    if (ch === "}" && next === "}") {
      depthCurly = Math.max(0, depthCurly - 1);
      current += "}}";
      i++;
      continue;
    }
    if (ch === "[" && next === "[") {
      depthBracket++;
      current += "[[";
      i++;
      continue;
    }
    if (ch === "]" && next === "]") {
      depthBracket = Math.max(0, depthBracket - 1);
      current += "]]";
      i++;
      continue;
    }
    if (ch === "|" && depthCurly === 0 && depthBracket === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length) parts.push(current);
  return parts;
}

function extractMantraBlock(wikitext, mantraName) {
  const lines = wikitext.split("\n");
  const target = mantraName.toLowerCase().trim();

  let nameLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (/^\|\s*name\s*=/i.test(trimmed)) {
      const value = trimmed
        .replace(/^\|\s*name\s*=/i, "")
        .trim()
        .toLowerCase();
      if (value.includes(target)) {
        nameLineIdx = i;
        break;
      }
    }
  }
  if (nameLineIdx === -1) return null;

  let blockStart = -1;
  for (let j = nameLineIdx; j >= 0; j--) {
    if (lines[j].includes("{{MantraInfobox")) {
      blockStart = j;
      break;
    }
  }
  if (blockStart === -1) return null;

  const blockEnd = findBlockEnd(lines, blockStart);
  return lines.slice(blockStart, blockEnd + 1).join("\n");
}

function extractNamedInfobox(wikitext, templateNameFragments) {
  const lines = wikitext.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let searchFrom = 0;
    while (true) {
      const openIdx = line.indexOf("{{", searchFrom);
      if (openIdx === -1) break;

      for (const fragment of templateNameFragments) {
        const normalizedLine = line
          .slice(openIdx)
          .replace(/[_\s]/g, "")
          .toLowerCase();
        const normalizedFragment = fragment.replace(/[_\s]/g, "").toLowerCase();
        if (normalizedLine.startsWith(`{{${normalizedFragment}`)) {
          const blockEnd = findBlockEndFromIndex(lines, i, openIdx);
          return lines.slice(i, blockEnd + 1).join("\n");
        }
      }
      searchFrom = openIdx + 2;
    }
  }
  return null;
}

function extractForKind(wikitext, kind) {
  const templates = TEMPLATE_MAP[kind];
  if (!templates) return null;
  return extractNamedInfobox(wikitext, templates);
}

function extractAnyInfobox(wikitext) {
  const lines = wikitext.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let searchFrom = 0;
    while (true) {
      const openIdx = line.indexOf("{{", searchFrom);
      if (openIdx === -1) break;

      const afterBraces = line.slice(openIdx + 2);
      const nameMatch = afterBraces.match(/^([^|}\n]+)/);
      if (nameMatch && /infobox/i.test(nameMatch[1])) {
        const blockEnd = findBlockEndFromIndex(lines, i, openIdx);
        return lines.slice(i, blockEnd + 1).join("\n");
      }
      searchFrom = openIdx + 2;
    }
  }
  return null;
}

function extractFirstProse(wikitext) {
  const lines = wikitext.split("\n");
  let collecting = false;
  const parts = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/^=+\s*.+\s*=+$/.test(t)) {
      if (collecting) break;
      collecting = true;
      continue;
    }
    if (!collecting) continue;
    if (t.startsWith("{{")) continue;
    if (t.startsWith("[[")) continue;
    if (t.startsWith("<")) continue;
    if (t.startsWith("|")) continue;
    if (t.startsWith("*") || t.startsWith("#")) continue;
    if (t.startsWith("__")) continue;
    parts.push(t);
    if (parts.length >= 3) break;
  }

  if (parts.length === 0) {
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (t.startsWith("{{")) continue;
      if (t.startsWith("[[")) continue;
      if (t.startsWith("<")) continue;
      if (t.startsWith("|")) continue;
      if (t.startsWith("''")) return t;
    }
  }

  return parts.join(" ").slice(0, 500) || null;
}

function extractTalentBlock(wikitext, talentName) {
  const lines = wikitext.split("\n");
  const target = talentName.toLowerCase().trim();

  const candidates = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\{\{\s*TalentInfo\/Talents/i.test(lines[i])) continue;

    const blockEnd = findBlockEnd(lines, i);
    const block = lines.slice(i, blockEnd + 1).join("\n");

    const nameMatch = block.match(/\|\s*name\s*=\s*([^|]+)/i);
    if (nameMatch) {
      candidates.push({ block, blockName: nameMatch[1].trim().toLowerCase() });
    }
    i = blockEnd;
  }

  let found = candidates.find((c) => c.blockName === target);
  if (found) return found.block;

  found = candidates.find(
    (c) => c.blockName.includes(target) || target.includes(c.blockName)
  );
  if (found) return found.block;

  console.log(
    "[extractTalentBlock] NO MATCH for:",
    target,
    "| candidates:",
    candidates.length
  );
  return null;
}

function extractUlidTalent(wikitext, talentName) {
  const lines = wikitext.split("\n");
  const target = talentName.toLowerCase().trim();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const ulidMatch = trimmed.match(/^\{\{ulid\|([^}]+)\}\}$/i);
    if (!ulidMatch) continue;
    if (ulidMatch[1].trim().toLowerCase() !== target) continue;

    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) return null;

    const descLine = lines[j].trim();
    const m = descLine.match(/^\*\s*([^[]+?)\s*\[([^\]]+)\]\s*-\s*(.+)$/);
    if (!m) return null;

    return {
      name: cleanWikiValue(m[1].trim()),
      tags: cleanWikiValue(m[2].trim()),
      description: cleanWikiValue(m[3].trim())
    };
  }
  return null;
}

function cleanWikiValue(value, pageName = null) {
  let result = value;

  if (pageName) {
    result = result
      .split("\n")
      .filter((line) => {
        const stripped = line
          .replace(/'''/g, "")
          .replace(/''/g, "")
          .replace(/\{\{PAGENAME\}\}/gi, "")
          .replace(/\{\{text\|[^}]*\}\}/gi, "")
          .replace(/[\[\]]/g, "")
          .trim();
        return stripped !== "";
      })
      .join("\n");
  }

  if (pageName) {
    result = result.replace(/\{\{PAGENAME\}\}/gi, pageName);
  }

  result = result.replace(/\{\{stats\|([^|{}]*)\|([^|{}]*)[^{}]*\}\}/gi, "$2");

  result = result.replace(/\{\{Set\|([^{}]*)\}\}/gi, (_m, inner) => {
    const args = splitTopLevelPipes(inner)
      .map((a) => a.trim())
      .filter(Boolean);
    const items = args.filter((a) => !/^[a-z]+\s*=/i.test(a));
    return items.join(" · ");
  });

  result = result.replace(/\{\{W\|[^{}]*\}\}/gi, "");

  result = result
    .replace(/\{\{sic\|[^{}]*\}\}/gi, "")
    .replace(
      /\{\{c\|([^|{}]+)\|([^{}]+)\}\}/gi,
      (_m, type, amount) => `${amount.trim()} ${type.trim()}`
    )
    .replace(/\{\{t\|([^|{}]+)[^{}]*\}\}/gi, "$1")
    .replace(/\{\{(?:status|cl)\|([^{}]*)\}\}/gi, (_m, inner) => {
      const parts = splitTopLevelPipes(inner).map((p) => p.trim());
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i] && !/^[a-z]+\s*=/i.test(parts[i])) return parts[i];
      }
      return parts[parts.length - 1] || "";
    })
    .replace(/\{\{ttag\|([^{}]+)\}\}/gi, "[$1]")
    .replace(/\{\{abf\|(?:[^|{}]*\|)?([^{}]*)\}\}/gi, "$1")
    .replace(/\{\{iv\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{input\|(?:[^|{}]*\|)?([^{}]*)\}\}/gi, "$1")
    .replace(/\{\{FactionIcon\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{AttackTags?\|([^{}]*)\}\}/gi, "[$1]")
    .replace(/\{\{g\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{etal\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{anch\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{lp\|([^{}]*)\}\}/gi, "")
    .replace(/\{\{History\}\}/gi, "")
    .replace(/\{\{VersionHistory\}\}/gi, "")
    .replace(/\{\{Nav\|[^{}]*\}\}/gi, "")
    .replace(/\{\{clear\}\}/gi, "")
    .replace(/\{\{Clear\}\}/gi, "");

  // Adjacent links [[A]][[B]] would otherwise become "AB" with no gap.
  result = result.replace(/\]\]\s*\[\[/g, "]] · [[");

  result = result
    .replace(/\[\[\s*(?:File|Image)\s*:[^\]]*\]\]/gi, "")
    .replace(
      /(?:^|\n)\s*(?:File|Image)\s*:[^\n]*(?:\.gif|\.png|\.jpg|\.jpeg|\.webp)[^\n]*/gi,
      ""
    )
    .replace(/\{\{[^{}]*\}\}/g, "")
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/<[^>]*>/g, "")
    .replace(/'{2,}/g, "")
    .replace(/\n{2,}/g, "\n")
    .trim()
    .replace(/\}\}\s*$/, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (pageName) {
    const lower = pageName.toLowerCase();
    result = result
      .split("\n")
      .filter((line) => line.trim().toLowerCase() !== lower)
      .join("\n");
  }

  // Punctuation-only values are noise; blank them so the caller skips.
  if (/^[\s.\-–—…,;:]+$/.test(result)) {
    return "";
  }

  return result;
}

function parseImageLine(line) {
  if (!line) return null;
  let v = line.trim();
  if (!v) return null;
  v = v.replace(/^\[\[|\]\]$/g, "");
  v = v.replace(/^(File|Image):/i, "");
  v = v.split("|")[0].trim();
  if (!v) return null;
  if (!/\.(png|jpe?g|gif|webp|bmp)$/i.test(v)) return null;
  return v;
}

function extractFirstImageFilename(block) {
  const lines = block.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\|\s*image\d*\s*=\s*(.*)$/i);
    if (!m) continue;

    const value = m[1].trim();
    if (!value) continue;

    if (/<gallery/i.test(value)) {
      const sameLine = value.match(/<gallery[^>]*>([^<]*)<\/gallery>/i);
      if (sameLine) {
        const name = parseImageLine(sameLine[1].split("\n")[0]);
        if (name) return name;
      }
      for (let j = i + 1; j < lines.length; j++) {
        const t = lines[j].trim();
        if (/<\/gallery>/i.test(t)) break;
        if (!t) continue;
        if (/^<gallery/i.test(t)) continue;
        const name = parseImageLine(t);
        if (name) return name;
      }
      return null;
    }

    const name = parseImageLine(value);
    if (name) return name;
  }
  return null;
}

function resolveImageUrl(block) {
  const filename = extractFirstImageFilename(block);
  if (!filename) {
    console.log("[resolveImageUrl] no image filename found in block");
    return null;
  }
  const url = `https://deepwoken.fandom.com/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
  console.log(`[resolveImageUrl] using ${filename}`);
  return url;
}

function parseTalentBlock(block, pageName = null) {
  let text = block.trim();
  text = text.replace(/^\{\{\s*TalentInfo\/Talents/i, "");
  text = text.replace(/\}\}\s*$/, "");
  if (text.startsWith("|")) text = text.slice(1);

  const parts = splitTopLevelPipes(text);
  const data = {};

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim().toLowerCase();
    const rawValue = part.slice(eqIdx + 1).trim();
    const value = cleanWikiValue(rawValue, pageName);
    if (value) data[key] = value;
  }

  return data;
}

function parseInfoboxBlock(block, pageName = null) {
  const data = {};
  const innerLines = block.split("\n");

  if (innerLines.length && innerLines[0].includes("{{")) {
    innerLines.shift();
  }
  if (innerLines.length && innerLines[innerLines.length - 1].trim() === "}}") {
    innerLines.pop();
  }

  let currentKey = null;
  let currentValue = [];

  for (const line of innerLines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("|")) {
      if (currentKey) {
        data[currentKey] = currentValue.join("\n").trim();
        currentKey = null;
        currentValue = [];
      }
      const clean = trimmed.slice(1);
      const eqIdx = clean.indexOf("=");
      if (eqIdx > 0) {
        currentKey = clean.slice(0, eqIdx).trim().toLowerCase();
        let valuePart = clean.slice(eqIdx + 1).trim();
        if (valuePart) {
          currentValue.push(valuePart);
        }
      } else {
        currentKey = null;
        currentValue = [];
      }
    } else if (currentKey) {
      currentValue.push(trimmed);
    }
  }
  if (currentKey) {
    data[currentKey] = currentValue.join("\n").trim();
  }

  for (const key in data) {
    data[key] = cleanWikiValue(data[key], pageName);
  }

  return data;
}

export function getField(data, aliases) {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (data[key]) return data[key];
  }
  return null;
}

export async function getPageInfo(title, searchQuery, kind) {
  const searchName = searchQuery || title;

  if (kind === "talent") {
    const talentsPage = await getPageWikitext("Talents");
    if (talentsPage) {
      const talentBlock = extractTalentBlock(talentsPage.wikitext, searchName);
      if (talentBlock) {
        const data = parseTalentBlock(talentBlock);
        if (Object.keys(data).length > 0) {
          return {
            title: talentsPage.title,
            infobox: data,
            source: "talent-block",
            redirect: null
          };
        }
      }

      const ulidTalent = extractUlidTalent(talentsPage.wikitext, searchName);
      if (ulidTalent) {
        return {
          title: talentsPage.title,
          infobox: {
            name: ulidTalent.name,
            tags: ulidTalent.tags,
            description: ulidTalent.description
          },
          source: "talent-ulid",
          redirect: null
        };
      }
    }
  }

  if (kind !== "talent") {
    const talentsPage = await getPageWikitext("Talents");
    if (talentsPage) {
      const talentBlock = extractTalentBlock(talentsPage.wikitext, searchName);
      if (talentBlock) {
        const data = parseTalentBlock(talentBlock);
        if (Object.keys(data).length > 0) {
          return {
            title: talentsPage.title,
            infobox: data,
            source: "talent-block-untyped",
            redirect: null
          };
        }
      }

      const ulidTalent = extractUlidTalent(talentsPage.wikitext, searchName);
      if (ulidTalent) {
        return {
          title: talentsPage.title,
          infobox: {
            name: ulidTalent.name,
            tags: ulidTalent.tags,
            description: ulidTalent.description
          },
          source: "talent-ulid-untyped",
          redirect: null
        };
      }
    }

    if (!searchName.toLowerCase().startsWith("oath:")) {
      const oathTitle = `Oath: ${searchName}`;
      const oathPage = await getPageWikitext(oathTitle);
      if (oathPage) {
        const block = extractForKind(oathPage.wikitext, "oath");
        if (block) {
          const data = parseInfoboxBlock(block, oathPage.title);
          if (Object.keys(data).length > 0) {
            if (!data.description && !data.effect && !data.desc) {
              const prose = extractFirstProse(oathPage.wikitext);
              if (prose) {
                data.description = cleanWikiValue(prose, oathPage.title);
              }
            }
            const imageUrl = resolveImageUrl(block);
            if (imageUrl) data.__image_url = imageUrl;
            return {
              title: oathPage.title,
              infobox: data,
              source: "oath-infobox-untyped",
              redirect: oathPage.redirectTarget
            };
          }
        }
      }
    }
  }

  const result = await getPageWikitext(title);
  if (!result) return null;

  const wikitext = result.wikitext;
  const pageTitle = result.title;
  const redirectTarget = result.redirectTarget;

  let block = null;
  let source = "none";

  if (kind === "mantra" || !kind) {
    block = extractMantraBlock(wikitext, searchName);
    if (block) source = "mantra-block";
  }

  if (!block && kind && TEMPLATE_MAP[kind]) {
    block = extractForKind(wikitext, kind);
    if (block) source = `${kind}-infobox`;
  }

  if (!block) {
    for (const k of Object.keys(TEMPLATE_MAP)) {
      if (k === kind) continue;
      block = extractForKind(wikitext, k);
      if (block) {
        source = `${k}-infobox-any`;
        break;
      }
    }
  }

  if (!block) {
    block = extractAnyInfobox(wikitext);
    if (block) source = "generic-infobox";
  }

  if (block) {
    const data = /TalentInfo\/Talents/i.test(block)
      ? parseTalentBlock(block, pageTitle)
      : parseInfoboxBlock(block, pageTitle);

    if (Object.keys(data).length > 0) {
      if (!data.description && !data.effect && !data.desc) {
        const prose = extractFirstProse(wikitext);
        if (prose) {
          data.description = cleanWikiValue(prose, pageTitle);
        }
      }

      const imageUrl = resolveImageUrl(block);
      if (imageUrl) data.__image_url = imageUrl;

      return {
        title: pageTitle,
        infobox: data,
        source,
        redirect: redirectTarget
      };
    }
  }

  const prose = extractFirstProse(wikitext);
  if (prose) {
    return {
      title: pageTitle,
      infobox: {
        name: pageTitle,
        description: cleanWikiValue(prose, pageTitle)
      },
      source: "prose-fallback",
      redirect: redirectTarget
    };
  }

  return {
    title: pageTitle,
    infobox: {},
    source: "none",
    redirect: redirectTarget
  };
}
