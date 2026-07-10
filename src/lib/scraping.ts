import { getOpenAI } from "@/lib/openai";

export interface ScrapedSource {
  title: string;
  url: string;
  summary: string;
  date: string | null;
  domain: string;
  score: number;
}

export interface ScrapingConfig {
  consigne: string;
  tone?: string;
  language?: string;
  sourceTypes?: string[];
  maxAgeMonths?: number;
  excludedDomains?: string[];
}

async function generateSearchQueries(config: ScrapingConfig): Promise<string[]> {
  const openai = getOpenAI();
  const langLabel = config.language === "EN" ? "anglais" : "francais";
  const typesLabel = config.sourceTypes && config.sourceTypes.length ? config.sourceTypes.join(", ") : "generalistes";
  const prompt = [
    "Tu es un assistant de recherche documentaire.",
    "A partir de la consigne suivante, genere entre 4 et 6 requetes de recherche web courtes et optimisees en " + langLabel + " pour trouver des sources fiables et recentes.",
    "Consigne: " + config.consigne,
    "Types de sources souhaitees: " + typesLabel,
    'Reponds uniquement en JSON strict de la forme {"queries": ["...", "..."]}.',
    ].join("\n");

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "Tu generes des requetes de recherche web precises et variees." },
    { role: "user", content: prompt },
    ],
});

const raw = completion.choices[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.queries)) {
      return parsed.queries.slice(0, 6);
    }
  } catch (err) {
    console.error("generateSearchQueries parse error", err);
  }
  return [config.consigne];
}

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

async function searchTavily(query: string): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("TAVILY_API_KEY manquant, recherche Tavily ignoree");
    return [];
  }

const res = await fetch("https://api.tavily.com/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: apiKey,
    query,
    search_depth: "advanced",
    max_results: 5,
    include_answer: false,
  }),
});

if (!res.ok) {
  console.error("Tavily error", res.status, await res.text());
  return [];
}

const data = await res.json();
  return (data.results || []) as TavilyResult[];
}

interface WikipediaResult {
  title: string;
  url: string;
  extract: string;
}

async function searchWikipedia(query: string, language: string): Promise<WikipediaResult[]> {
  const lang = language === "EN" ? "en" : "fr";
  try {
    const searchRes = await fetch(
      `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*&srlimit=3`
      );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const hits = searchData?.query?.search || [];

  const results: WikipediaResult[] = [];
    for (const hit of hits) {
      const title = hit.title;
      const summaryRes = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
        );
      if (!summaryRes.ok) continue;
      const summaryData = await summaryRes.json();
      results.push({
        title: summaryData.title || title,
        url: summaryData.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        extract: summaryData.extract || "",
      });
    }
    return results;
  } catch (err) {
    console.error("searchWikipedia error", err);
    return [];
  }
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www./, "");
  } catch {
    return "";
  }
}

function isTooOld(dateStr: string | undefined, maxAgeMonths: number | undefined): boolean {
  if (!dateStr || !maxAgeMonths) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const ageMonths = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
  return ageMonths > maxAgeMonths;
}

function truncate(text: string, maxWords: number): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "...";
}

export async function scrapeSources(config: ScrapingConfig): Promise<ScrapedSource[]> {
  const queries = await generateSearchQueries(config);
  const excluded = (config.excludedDomains || []).map((d) => d.toLowerCase().trim());

const tavilyResults = await Promise.all(queries.map((q) => searchTavily(q)));
  const wikipediaResults = await searchWikipedia(config.consigne, config.language || "FR");

const sources: ScrapedSource[] = [];

for (const batch of tavilyResults) {
  for (const item of batch) {
    const domain = getDomain(item.url);
    if (!domain) continue;
    if (excluded.some((d) => domain.includes(d))) continue;
    if (isTooOld(item.published_date, config.maxAgeMonths)) continue;
    sources.push({
      title: item.title,
      url: item.url,
      summary: truncate(item.content || "", 200),
      date: item.published_date || null,
      domain,
      score: item.score ?? 0.5,
    });
  }
}

for (const item of wikipediaResults) {
  const domain = getDomain(item.url);
  if (excluded.some((d) => domain.includes(d))) continue;
  sources.push({
    title: item.title,
    url: item.url,
    summary: truncate(item.extract || "", 200),
    date: null,
    domain,
    score: 0.6,
  });
}

const seen = new Set<string>();
  const deduped = sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });

deduped.sort((a, b) => b.score - a.score);

return deduped.slice(0, 8);
}
