const BASE_URL = "https://deepwoken.fandom.com/api.php";

export async function searchWiki(query) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    format: "json",
    origin: "*"
  });

  const response = await fetch(`${BASE_URL}?${params}`);
  const data = await response.json();
  
  if (!data.query?.search?.length) return null;
  return data.query.search[0].title;
}

export async function getPageWikitext(pageTitle) {
  const params = new URLSearchParams({
    action: "query",
    prop: "revisions",
    titles: pageTitle,
    rvprop: "content",
    rvslots: "main",
    format: "json",
    origin: "*"
  });

  const response = await fetch(`${BASE_URL}?${params}`);
  const data = await response.json();
  
  const pages = data.query?.pages;
  if (!pages) return null;
  
  const pageId = Object.keys(pages)[0];
  if (pageId === "-1") return null;

  return {
    title: pages[pageId].title,
    wikitext: pages[pageId].revisions[0].slots.main["*"]
  };
}

export function parseInfobox(wikitext) {
  const infoboxData = {};
  const lines = wikitext.split("\n");
  
  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      const [key, ...valueParts] = line.trim().slice(1).split("=");
      if (key && valueParts.length > 0) {
        infoboxData[key.trim().toLowerCase()] = valueParts.join("=").trim()
          .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
          .replace(/<[^>]*>/g, "");
      }
    }
  }
  return infoboxData;
}
