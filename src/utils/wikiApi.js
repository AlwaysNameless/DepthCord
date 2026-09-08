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
  return data.query.search[0].title;
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

/**
 * Counts braces forward from a given line index to find where a
 * {{...}} template block closes. Returns the ending line index, or
 * a capped fallback if no matching close is found.
 */
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

/**
 * Finds a {{MantraInfobox...}} block whose |name= field matches mantraName.
 * Handles the case where the name appears on its own line, separate from
 * the opening {{MantraInfobox line (which may also have suffixes like "|end").
 * Multiple mantra blocks can live on one page (e.g. Thundercall), so we must
 * search by name rather than just grabbing the first block found.
 */
function extractMantraBlock(wikitext, mantraName) {
  const lines = wikitext.split("\n");
  const target = mantraName.toLowerCase().trim();

  // Step 1: find the line that declares |name=<mantraName>
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

  // Step 2: search backwards from the name line for the block opener
  let blockStart = -1;
  for (let j = nameLineIdx; j >= 0; j--) {
    if (lines[j].includes("{{MantraInfobox")) {
      blockStart = j;
      break;
    }
  }
  if (blockStart === -1) return null;

  // Step 3: count braces forward from blockStart to find the matching close
  const blockEnd = findBlockEnd(lines, blockStart);
  return lines.slice(blockStart, blockEnd + 1).join("\n");
}

/**
 * Finds the first infobox-style template on the page whose name matches
 * one of the given template name fragments (case-insensitive, e.g.
 * "Weapon_Infobox", "Talent_Infobox"). Unlike mantra blocks, these
 * templates are single flat blocks with no |name= field to search by —
 * the page title IS the item, so we just grab the first match.
 */
function extractNamedInfobox(wikitext, templateNameFragments) {
  const lines = wikitext.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openIdx = line.indexOf("{{");
    if (openIdx === -1) continue;

    for (const fragment of templateNameFragments) {
      const normalizedLine = line
        .slice(openIdx)
        .replace(/[_\s]/g, "")
        .toLowerCase();
      const normalizedFragment = fragment.replace(/[_\s]/g, "").toLowerCase();
      if (normalizedLine.startsWith(`{{${normalizedFragment}`)) {
        const blockEnd = findBlockEnd(lines, i);
        return lines.slice(i, blockEnd + 1).join("\n");
      }
    }
  }
  return null;
}

/**
 * Generic fallback: finds the FIRST template on the page whose name
 * contains "infobox" (case-insensitive), regardless of exact naming.
 * Used as a last resort when we don't know the exact template name
 * for a given content type.
 */
function extractAnyInfobox(wikitext) {
  const lines = wikitext.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const openIdx = line.indexOf("{{");
    if (openIdx === -1) continue;

    const afterBraces = line.slice(openIdx + 2);
    const nameMatch = afterBraces.match(/^([^|}\n]+)/);
    if (nameMatch && /infobox/i.test(nameMatch[1])) {
      const blockEnd = findBlockEnd(lines, i);
      return lines.slice(i, blockEnd + 1).join("\n");
    }
  }
  return null;
}

/**
 * Finds a {{TalentInfo/Talents|...}} block whose |name= param matches
 * talentName. Unlike MantraInfobox (one field per line) or Weapon/Talent
 * infoboxes (single block per page), TalentInfo/Talents blocks are laid
 * out as many piped fields flowing across several lines, and MANY of
 * these blocks live together on the single master "Talents" page. So we
 * have to scan the whole page, extract every block, and match by name.
 */
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
    i = blockEnd; // don't rescan lines already consumed by this block
  }

  // Prefer an exact name match first...
  let found = candidates.find((c) => c.blockName === target);
  if (found) return found.block;

  // ...then fall back to a loose substring match either direction.
  found = candidates.find(
    (c) => c.blockName.includes(target) || target.includes(c.blockName)
  );
  return found ? found.block : null;
}

/**
 * Splits a string on top-level "|" characters only — i.e. ignores any "|"
 * that appears inside a nested {{...}} template or [[...]] link. Needed
 * to correctly separate TalentInfo/Talents' piped fields, since those
 * fields commonly contain nested templates/links that themselves use "|"
 * (e.g. {{t|Some Talent|r=rare}}, [[Cauldron|a cauldron]]).
 */
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

/**
 * Parses a {{TalentInfo/Talents|key=value|key=value...}} block into a
 * flat key/value object. Intentionally leaves inner {{t|...}}, {{abf|...}},
 * {{status|...}} etc. macros mostly intact (only stripping images/links) —
 * the display layer is responsible for turning those into readable text,
 * since fully resolving them here would lose information other callers
 * might want raw.
 */
function parseTalentBlock(block) {
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
    let value = part.slice(eqIdx + 1).trim();

    value = value
      .replace(/\[\[\s*(?:File|Image)\s*:[^\]]*\]\]/gi, "")
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/''/g, "")
      .trim();

    if (value) data[key] = value;
  }

  return data;
}

/**
 * Parses a {{SomeInfobox ... }} block into a flat key/value object.
 * Strips the block's own opening/closing delimiters first so a
 * lingering "}}" terminator line never gets glued onto the last
 * field's value.
 */
function parseInfoboxBlock(block) {
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
    let value = data[key];
    value = value
      .replace(/\{\{stats\|[^|]*\|([^}]*)\}\}/g, "$1")
      .replace(/\[\[\s*(?:File|Image)\s*:[^\]]*\]\]/gi, "")
      .replace(
        /(?:^|\n)\s*(?:File|Image)\s*:[^\n]*(?:\.gif|\.png|\.jpg|\.jpeg|\.webp)[^\n]*/gi,
        ""
      )
      .replace(/\{\{[^}]*\}\}/g, "")
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/''/g, "")
      .replace(/\n{2,}/g, "\n")
      .trim()
      .replace(/\}\}\s*$/, "")
      .trim();
    data[key] = value;
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

/**
 * Fetches page info and extracts the relevant infobox block.
 *
 * @param {string} title - The wiki page title to fetch. For talents this
 *   is only used as a fallback; the primary lookup always checks the
 *   master "Talents" page regardless of what's passed here.
 * @param {string} [searchQuery] - For mantras/talents: the specific item
 *   name to look for inside a shared page's many named blocks.
 * @param {"mantra"|"weapon"|"talent"} [kind] - Which infobox template to
 *   look for.
 */
export async function getPageInfo(title, searchQuery, kind) {
  const searchName = searchQuery || title;

  // Talents live as individual blocks on the shared "Talents" page rather
  // than on their own pages, so resolve those directly by name first,
  // bypassing whatever (often wrong) page `title` fuzzy search landed on.
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
    }
    // Falls through below if not found — e.g. talent has its own
    // standalone page, or wasn't matched on the Talents page.
  }

  const result = await getPageWikitext(title);
  if (!result) return null;

  const wikitext = result.wikitext;
  const pageTitle = result.title;
  const redirectTarget = result.redirectTarget;

  let block = null;
  let source = "none";

  if (kind === "weapon") {
    block = extractNamedInfobox(wikitext, ["Weapon_Infobox", "WeaponInfobox"]);
    if (block) source = "weapon-infobox";
  } else if (kind === "talent") {
    block =
      extractTalentBlock(wikitext, searchName) ||
      extractNamedInfobox(wikitext, [
        "Talent_Infobox",
        "TalentInfobox",
        "Talent_Card_Infobox",
        "TalentCardInfobox"
      ]);
    if (block) source = "talent-fallback";
  } else if (kind === "mantra") {
    block = extractMantraBlock(wikitext, searchName);
    if (block) source = "mantra-block";
  }

  if (!block) {
    block = extractMantraBlock(wikitext, searchName);
    if (block) source = "mantra-block";
  }
  if (!block) {
    block = extractAnyInfobox(wikitext);
    if (block) source = "generic-infobox";
  }

  if (block) {
    const data =
      source === "talent-fallback" && /TalentInfo\/Talents/i.test(block)
        ? parseTalentBlock(block)
        : parseInfoboxBlock(block);
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
