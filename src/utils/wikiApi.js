const BASE_URL = "https://deepwoken.fandom.com/api.php";

export async function searchWiki(query) {
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
  const target = query.toLowerCase().trim();

  const exact = results.find((r) => r.title.toLowerCase().trim() === target);
  if (exact) return exact.title;

  const top = results[0];
  const topLower = top.title.toLowerCase();

  const queryWords = target.split(/\s+/).filter((w) => w.length > 2);
  const sharesWord = queryWords.some((w) => topLower.includes(w));

  console.log(
    "[searchWiki] query:",
    target,
    "| top:",
    top.title,
    "| shares word:",
    sharesWord
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

  if (page.redirect) {
    const target = page.redirect[0].to;
    const targetParams = new URLSearchParams({
      action: "query",
      prop: "revisions",
      titles: target,
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
        return {
          title: targetPage.title,
          wikitext: targetPage.revisions[0].slots.main["*"],
          redirectTarget: target
        };
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

function extractOathBlock(wikitext) {
  return extractNamedInfobox(wikitext, ["Oath"]);
}

function extractEnchantBlock(wikitext) {
  return extractNamedInfobox(wikitext, ["Relic"]);
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

function extractTalentBlock(wikitext, talentName) {
  const lines = wikitext.split("\n");
  const target = talentName.toLowerCase().trim();
  console.log("[extractTalentBlock] looking for:", target);
  console.log("[extractTalentBlock] total lines:", lines.length);

  const candidates = [];
  let templateMatchCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!/\{\{\s*TalentInfo\/Talents/i.test(lines[i])) continue;
    templateMatchCount++;

    const blockEnd = findBlockEnd(lines, i);
    const block = lines.slice(i, blockEnd + 1).join("\n");

    const nameMatch = block.match(/\|\s*name\s*=\s*([^|]+)/i);
    if (nameMatch) {
      candidates.push({ block, blockName: nameMatch[1].trim().toLowerCase() });
    }
    i = blockEnd;
  }

  console.log("[extractTalentBlock] template matches:", templateMatchCount);
  console.log("[extractTalentBlock] candidates with name:", candidates.length);

  let found = candidates.find((c) => c.blockName === target);
  if (found) {
    console.log("[extractTalentBlock] exact match found:", found.blockName);
    return found.block;
  }

  found = candidates.find(
    (c) => c.blockName.includes(target) || target.includes(c.blockName)
  );
  if (found) {
    console.log("[extractTalentBlock] substring match found:", found.blockName);
    return found.block;
  }

  console.log(
    "[extractTalentBlock] NO MATCH. Closest names:",
    candidates
      .map((c) => c.blockName)
      .filter(
        (n) => n.includes(target.slice(0, 5)) || target.includes(n.slice(0, 5))
      )
      .slice(0, 10)
  );
  return null;
}

function extractUlidTalent(wikitext, talentName) {
  const lines = wikitext.split("\n");
  const target = talentName.toLowerCase().trim();
  console.log("[extractUlidTalent] looking for:", target);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    const ulidMatch = trimmed.match(/^\{\{ulid\|([^}]+)\}\}$/i);
    if (!ulidMatch) continue;
    if (ulidMatch[1].trim().toLowerCase() !== target) continue;

    console.log("[extractUlidTalent] found ulid marker at line", i);

    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) {
      console.log("[extractUlidTalent] no description line after marker");
      return null;
    }

    const descLine = lines[j].trim();
    const m = descLine.match(/^\*\s*([^[]+?)\s*\[([^\]]+)\]\s*-\s*(.+)$/);
    if (!m) {
      console.log(
        "[extractUlidTalent] description line did not match pattern:",
        descLine
      );
      return null;
    }

    return {
      name: cleanWikiValue(m[1].trim()),
      tags: cleanWikiValue(m[2].trim()),
      description: cleanWikiValue(m[3].trim())
    };
  }

  console.log("[extractUlidTalent] no ulid marker found");
  return null;
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

function cleanWikiValue(value, pageName = null) {
  let result = value;

  if (pageName) {
    // Whole-line removal of PAGENAME patterns BEFORE the generic template
    // strip, otherwise the leftovers become an orphan "Stone" line.
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

  result = result.replace(/\{\{stats\|[^|]*\|([^{}]*)\}\}/gi, "$1");

  if (pageName) {
    result = result.replace(/\{\{PAGENAME\}\}/gi, pageName);
  }

  result = result
    .replace(/\{\{sic\|[^{}]*\}\}/gi, "")
    .replace(
      /\{\{c\|([^|{}]+)\|([^{}]+)\}\}/gi,
      (_m, type, amount) => `${amount.trim()} ${type.trim()}`
    )
    .replace(/\{\{t\|([^|{}]+)[^{}]*\}\}/gi, "$1")
    .replace(/\{\{(?:status|cl)\|([^{}]*)\}\}/gi, (_m, inner) => {
      const parts = inner.split("|").map((p) => p.trim());
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i] && !/^[a-z]+\s*=/i.test(parts[i])) return parts[i];
      }
      return parts[parts.length - 1] || "";
    })
    .replace(/\{\{ttag\|([^{}]+)\}\}/gi, "[$1]")
    .replace(/\{\{abf\|(?:[^|{}]*\|)?([^{}]*)\}\}/gi, "$1")
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

  return result;
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
  console.log(
    "[getPageInfo] title:",
    title,
    "| searchQuery:",
    searchQuery,
    "| kind:",
    kind
  );

  if (kind === "enchant") {
    console.log("[getPageInfo] enchant lookup:", searchName);
    const result = await getPageWikitext(title);
    if (result) {
      const block = extractEnchantBlock(result.wikitext);
      if (block) {
        const data = parseInfoboxBlock(block, result.title);
        if (Object.keys(data).length > 0) {
          return {
            title: result.title,
            infobox: data,
            source: "enchant-infobox",
            redirect: result.redirectTarget
          };
        }
      }
    }
  }

  if (kind === "talent") {
    console.log("[getPageInfo] fetching Talents page (typed talent)...");
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
      console.log("[getPageInfo] trying untyped oath fallback:", oathTitle);
      const oathPage = await getPageWikitext(oathTitle);
      if (oathPage) {
        const block = extractOathBlock(oathPage.wikitext);
        if (block) {
          const data = parseInfoboxBlock(block, oathPage.title);
          if (Object.keys(data).length > 0) {
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

  console.log("[getPageInfo] fetching page:", title);
  const result = await getPageWikitext(title);
  if (!result) return null;

  const wikitext = result.wikitext;
  const pageTitle = result.title;
  const redirectTarget = result.redirectTarget;

  let block = null;
  let source = "none";

  if (kind === "weapon") {
    block = extractNamedInfobox(wikitext, [
      "Weapon_Infobox",
      "WeaponInfobox",
      "Weapon Infobox"
    ]);
    if (block) source = "weapon-infobox";
  } else if (kind === "mantra") {
    block = extractMantraBlock(wikitext, searchName);
    if (block) source = "mantra-block";
  }

  if (!block) {
    block = extractMantraBlock(wikitext, searchName);
    if (block) source = "mantra-block";
  }
  if (!block) {
    block = extractNamedInfobox(wikitext, [
      "Weapon_Infobox",
      "WeaponInfobox",
      "Weapon Infobox"
    ]);
    if (block) source = "weapon-infobox";
  }
  if (!block) {
    block = extractEnchantBlock(wikitext);
    if (block) source = "enchant-infobox-any";
  }
  if (!block) {
    block = extractOathBlock(wikitext);
    if (block) source = "oath-infobox-any";
  }
  if (!block) {
    block = extractAnyInfobox(wikitext);
    if (block) source = "generic-infobox";
  }

  console.log("[getPageInfo] page block source:", source);

  if (block) {
    const data = /TalentInfo\/Talents/i.test(block)
      ? parseTalentBlock(block, pageTitle)
      : parseInfoboxBlock(block, pageTitle);
    if (Object.keys(data).length > 0) {
      return {
        title: pageTitle,
        infobox: data,
        source,
        redirect: redirectTarget
      };
    }
  }

  return {
    title: pageTitle,
    infobox: {},
    source: "none",
    redirect: redirectTarget
  };
}
