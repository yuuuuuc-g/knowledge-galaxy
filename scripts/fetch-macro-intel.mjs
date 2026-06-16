#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import Parser from "rss-parser";
import { EnvHttpProxyAgent, ProxyAgent, Socks5ProxyAgent, setGlobalDispatcher } from "undici";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", override: false, quiet: true });

const DEFAULT_OUTPUT = "public/data/macro-intel.json";
const DEFAULT_RAW_OUTPUT = "public/data/macro-raw-articles.json";
const FETCH_TIMEOUT_MS = 12_000;
const MAX_CANDIDATES = 12;
const MAX_ITEMS = 4;
const MIN_SUMMARY_LENGTH = 200;
const SOURCE_REGISTRY_PATH = new URL("../config/intelligence-sources.json", import.meta.url);

const DEFAULT_SOURCES = loadSourcesFromRegistry("macro-intel");

const MACRO_KEYWORDS = [
  "policy",
  "central bank",
  "tariff",
  "trade",
  "fiscal",
  "debt",
  "bond",
  "subsidy",
  "budget",
  "industrial",
  "manufacturing",
  "export",
  "import",
  "inflation",
  "credit",
  "property",
  "yuan",
  "renminbi",
  "china",
  "beijing",
  "asia",
  "geopolitical",
  "sanction",
];

function parseArgs(argv) {
  const args = {
    output: DEFAULT_OUTPUT,
    rawOutput: DEFAULT_RAW_OUTPUT,
    stdout: false,
  };

  argv.forEach((arg) => {
    if (arg === "--stdout") {
      args.stdout = true;
      return;
    }
    if (arg.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
      return;
    }
    if (arg.startsWith("--raw-output=")) {
      args.rawOutput = arg.slice("--raw-output=".length);
      return;
    }
    if (arg === "--help") {
      args.help = true;
    }
  });

  return args;
}

function showHelp() {
  console.log(`Usage:
  node scripts/fetch-macro-intel.mjs [--output=public/data/macro-intel.json] [--raw-output=public/data/macro-raw-articles.json] [--stdout]

Environment:
  DEEPSEEK_API_KEY              Preferred. Enables DeepSeek extraction.
  DEEPSEEK_MODEL                Optional. Defaults to deepseek-v4-pro.
  OPENAI_API_KEY                Optional fallback. Enables OpenAI extraction.
  OPENAI_MODEL                  Optional. Defaults to gpt-4o-mini.
  MACRO_INTEL_SOURCES_JSON      Optional JSON array: [{ "name": "...", "url": "..." }]
  MACRO_INTEL_PROXY             Optional explicit proxy, e.g. http://127.0.0.1:7890 or socks5://127.0.0.1:7890.
  HTTPS_PROXY / HTTP_PROXY      Optional standard proxy env vars used by Node fetch.
  ALL_PROXY                     Optional fallback proxy copied to HTTP(S)_PROXY when those are absent.
  NO_PROXY                      Optional proxy bypass list.

The script writes the Intelligence Board payload:
  { generatedAt, sourceCount, candidatesCount, llmEnabled, items: [...] }
`);
}

function isRegistrySource(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.name === "string" &&
    typeof value.url === "string" &&
    Array.isArray(value.modules)
  );
}

function loadSourcesFromRegistry(moduleId) {
  const raw = readFileSync(SOURCE_REGISTRY_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed) || !parsed.every(isRegistrySource)) {
    throw new Error("Invalid intelligence source registry.");
  }

  return parsed
    .filter((source) => source.modules.includes(moduleId))
    .map((source) => ({
      name: source.name,
      url: source.url,
    }));
}

function readProxyEnv(name) {
  return process.env[name] ?? process.env[name.toLowerCase()];
}

function redactProxyUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) {
      url.username = "***";
      url.password = "***";
    }
    return url.toString();
  } catch {
    return "<configured>";
  }
}

function createProxyDispatcher(proxyUrl) {
  const normalizedProxyUrl = proxyUrl.toLowerCase();

  if (normalizedProxyUrl.startsWith("socks5://") || normalizedProxyUrl.startsWith("socks5h://")) {
    return new Socks5ProxyAgent(proxyUrl);
  }

  return new ProxyAgent(proxyUrl);
}

function configureProxy() {
  const explicitProxy = process.env.MACRO_INTEL_PROXY;

  if (explicitProxy) {
    setGlobalDispatcher(createProxyDispatcher(explicitProxy));
    console.log(`[MacroIntel] proxy enabled via MACRO_INTEL_PROXY: ${redactProxyUrl(explicitProxy)}`);
    return;
  }

  const allProxy = readProxyEnv("ALL_PROXY");
  if (allProxy) {
    process.env.HTTPS_PROXY = readProxyEnv("HTTPS_PROXY") ?? allProxy;
    process.env.HTTP_PROXY = readProxyEnv("HTTP_PROXY") ?? allProxy;
  }

  const proxy = readProxyEnv("HTTPS_PROXY") ?? readProxyEnv("HTTP_PROXY");
  if (!proxy) {
    return;
  }

  if (proxy.toLowerCase().startsWith("socks5://") || proxy.toLowerCase().startsWith("socks5h://")) {
    setGlobalDispatcher(createProxyDispatcher(proxy));
  } else {
    setGlobalDispatcher(new EnvHttpProxyAgent());
  }

  console.log(`[MacroIntel] proxy enabled via env: ${redactProxyUrl(proxy)}`);
}

configureProxy();

function loadSources() {
  const raw = process.env.MACRO_INTEL_SOURCES_JSON;
  if (!raw) {
    return DEFAULT_SOURCES;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (item) =>
          item &&
          typeof item === "object" &&
          typeof item.name === "string" &&
          typeof item.url === "string"
      )
    ) {
      return parsed;
    }
  } catch (error) {
    console.warn("[MacroIntel] MACRO_INTEL_SOURCES_JSON is invalid:", error);
  }

  return DEFAULT_SOURCES;
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3).trim()}...`;
}

function extractMainText(html) {
  const articleMatch = html.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  if (articleMatch?.[1]) {
    const articleText = stripHtml(articleMatch[1]);
    if (articleText.length >= MIN_SUMMARY_LENGTH) {
      return articleText;
    }
  }

  const contentMatch = html.match(
    /<div[^>]+(?:class|id)=["'][^"']*(?:content|article|post|entry|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  );
  if (contentMatch?.[1]) {
    const contentText = stripHtml(contentMatch[1]);
    if (contentText.length >= MIN_SUMMARY_LENGTH) {
      return contentText;
    }
  }

  return stripHtml(html);
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; KnowledgeGalaxyMacroIntel/1.0)",
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchFeed(parser, source) {
  try {
    const xml = await fetchText(source.url);
    const feed = await parser.parseString(xml);

    return (feed.items ?? [])
      .map((item) => {
        const title = stripHtml(item.title ?? "");
        const url = item.link ?? "";
        if (!title || !url) {
          return null;
        }

        return {
          source: source.name,
          title,
          url,
          summary: truncate(stripHtml(item.contentSnippet ?? item.content ?? ""), 900),
          publishedAt: item.isoDate ?? item.pubDate ?? null,
        };
      })
      .filter((item) => item !== null);
  } catch (error) {
    console.warn(`[MacroIntel] ${source.name} failed: ${String(error)}`);
    return [];
  }
}

async function resolveFullText(candidate) {
  if (candidate.summary.length >= MIN_SUMMARY_LENGTH) {
    return candidate.summary;
  }

  try {
    const html = await fetchText(candidate.url);
    return truncate(extractMainText(html), 5_500);
  } catch (error) {
    console.warn(`[MacroIntel] full-text fetch failed for ${candidate.url}: ${String(error)}`);
    return candidate.summary;
  }
}

function scoreCandidate(candidate) {
  const text = `${candidate.title} ${candidate.summary}`.toLowerCase();
  const keywordScore = MACRO_KEYWORDS.reduce((score, keyword) => {
    return text.includes(keyword) ? score + 1 : score;
  }, 0);
  const recencyScore = candidate.publishedAt ? 2 : 0;

  return keywordScore * 10 + recencyScore;
}

function detectEventType(text) {
  const lower = text.toLowerCase();

  if (lower.includes("bond") || lower.includes("debt") || lower.includes("fiscal") || lower.includes("budget")) {
    return "fiscal";
  }
  if (lower.includes("export") || lower.includes("import") || lower.includes("tariff") || lower.includes("trade")) {
    return "trade";
  }
  if (lower.includes("market") || lower.includes("stocks") || lower.includes("capital") || lower.includes("yuan")) {
    return "capital_market";
  }
  if (lower.includes("inflation") || lower.includes("gdp") || lower.includes("credit")) {
    return "macro_data";
  }
  if (lower.includes("sanction") || lower.includes("war") || lower.includes("geopolitical")) {
    return "geopolitics";
  }

  return "policy";
}

function heuristicAnalysis(candidate, index) {
  const text = `${candidate.title}. ${candidate.fullText || candidate.summary}`;
  const eventType = detectEventType(text);
  const impactScore = Math.min(88, Math.max(55, scoreCandidate(candidate) + 44));

  return {
    id: index + 1,
    title: candidate.title,
    source: candidate.source,
    url: candidate.url,
    eventType,
    coreLogic: truncate(candidate.summary || candidate.title, 110),
    policyIntent:
      eventType === "fiscal"
        ? "Fiscal stance or funding conditions may be shifting; verify against primary data before acting."
        : "Signal requires primary-source verification; current extraction is heuristic because LLM mode is disabled.",
    capitalImpact:
      eventType === "trade"
        ? "Trade-sensitive supply chains and exporters may reprice risk first."
        : "Capital impact is directional only until LLM extraction and evidence review are enabled.",
    affectedRegions: text.toLowerCase().includes("china") ? ["China", "APAC"] : ["Global"],
    affectedSectors: eventType === "trade" ? ["trade", "manufacturing"] : ["macro"],
    timeHorizon: impactScore >= 80 ? "short" : "medium",
    confidence: 0.55,
    impactScore,
    evidence: [truncate(candidate.summary || candidate.title, 140)],
    publishedAt: candidate.publishedAt,
  };
}

function buildPrompt(candidate) {
  return `You are a cautious macro intelligence analyst. Extract only from the source text.

Return strict JSON with this shape:
{
  "eventType": "policy" | "macro_data" | "trade" | "fiscal" | "capital_market" | "geopolitics",
  "coreLogic": string,
  "policyIntent": string,
  "capitalImpact": string,
  "affectedRegions": string[],
  "affectedSectors": string[],
  "timeHorizon": "short" | "medium" | "long",
  "confidence": number,
  "impactScore": number,
  "evidence": string[]
}

Rules:
- Use Chinese for coreLogic, policyIntent, capitalImpact, evidence.
- confidence must be 0.0-1.0.
- impactScore must be 0-100.
- evidence must quote or tightly paraphrase source facts, max 3 items.
- Do not invent facts not present in the source.

Source:
Title: ${candidate.title}
Source: ${candidate.source}
Published: ${candidate.publishedAt ?? "unknown"}
URL: ${candidate.url}
Text:
${truncate(candidate.fullText || candidate.summary, 5_500)}
`;
}

function isValidAnalysis(value) {
  return (
    value &&
    typeof value === "object" &&
    ["policy", "macro_data", "trade", "fiscal", "capital_market", "geopolitics"].includes(value.eventType) &&
    typeof value.coreLogic === "string" &&
    typeof value.policyIntent === "string" &&
    typeof value.capitalImpact === "string" &&
    Array.isArray(value.affectedRegions) &&
    Array.isArray(value.affectedSectors) &&
    ["short", "medium", "long"].includes(value.timeHorizon) &&
    typeof value.confidence === "number" &&
    typeof value.impactScore === "number" &&
    Array.isArray(value.evidence)
  );
}

async function createLlmClient() {
  const { default: OpenAI } = await import("openai");

  if (process.env.DEEPSEEK_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com/v1",
      }),
      model: process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro",
      provider: "deepseek",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      provider: "openai",
    };
  }

  return null;
}

async function llmAnalysis(llm, candidate, index) {
  if (!llm) {
    return heuristicAnalysis(candidate, index);
  }

  try {
    const response = await llm.client.chat.completions.create({
      model: llm.model,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract sober macro intelligence from source text and return only valid JSON.",
        },
        { role: "user", content: buildPrompt(candidate) },
      ],
    });
    const content = response.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(content);

    if (!isValidAnalysis(parsed)) {
      throw new Error("LLM returned invalid macro intelligence shape");
    }

    return {
      id: index + 1,
      title: candidate.title,
      source: candidate.source,
      url: candidate.url,
      eventType: parsed.eventType,
      coreLogic: truncate(parsed.coreLogic, 130),
      policyIntent: truncate(parsed.policyIntent, 170),
      capitalImpact: truncate(parsed.capitalImpact, 170),
      affectedRegions: parsed.affectedRegions.slice(0, 5),
      affectedSectors: parsed.affectedSectors.slice(0, 5),
      timeHorizon: parsed.timeHorizon,
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      impactScore: Math.round(Math.max(0, Math.min(100, parsed.impactScore))),
      evidence: parsed.evidence.slice(0, 3).map((item) => String(item)),
      publishedAt: candidate.publishedAt,
    };
  } catch (error) {
    console.warn(`[MacroIntel] LLM extraction failed for ${candidate.url}: ${String(error)}`);
    return heuristicAnalysis(candidate, index);
  }
}

async function buildPayload() {
  const sources = loadSources();
  const parser = new Parser({ timeout: FETCH_TIMEOUT_MS });
  const llm = await createLlmClient();
  const feedResults = await Promise.all(sources.map((source) => fetchFeed(parser, source)));
  const successfulSourceCount = feedResults.filter((items) => items.length > 0).length;
  const candidates = feedResults
    .flat()
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(candidate),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
    })
    .slice(0, MAX_CANDIDATES);

  const enrichedCandidates = await Promise.all(
    candidates.slice(0, MAX_ITEMS).map(async (candidate) => ({
      ...candidate,
      fullText: await resolveFullText(candidate),
    }))
  );
  const items = await Promise.all(
    enrichedCandidates.map((candidate, index) => llmAnalysis(llm, candidate, index))
  );
  const generatedAt = new Date().toISOString();
  const rawItems = candidates.map((candidate, index) => ({
    id: index + 1,
    source: candidate.source,
    title: candidate.title,
    url: candidate.url,
    snippet: candidate.summary,
    publishedAt: candidate.publishedAt,
    score: candidate.score,
  }));

  return {
    intel: {
      generatedAt,
      sourceCount: sources.length,
      successfulSourceCount,
      candidatesCount: candidates.length,
      llmEnabled: Boolean(llm),
      llmProvider: llm?.provider ?? null,
      items,
    },
    raw: {
      generatedAt,
      sourceCount: sources.length,
      successfulSourceCount,
      candidatesCount: candidates.length,
      items: rawItems,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    showHelp();
    return;
  }

  const payload = await buildPayload();
  const json = `${JSON.stringify(payload.intel, null, 2)}\n`;

  if (args.stdout) {
    process.stdout.write(json);
    return;
  }

  const outputPath = resolve(args.output);
  const rawOutputPath = resolve(args.rawOutput);
  await mkdir(dirname(outputPath), { recursive: true });
  await mkdir(dirname(rawOutputPath), { recursive: true });
  await writeFile(outputPath, json, "utf8");
  await writeFile(rawOutputPath, `${JSON.stringify(payload.raw, null, 2)}\n`, "utf8");
  console.log(
    `[MacroIntel] wrote ${payload.intel.items.length} intel items and ${payload.raw.items.length} raw articles (${payload.intel.candidatesCount} candidates, llm=${payload.intel.llmProvider ?? "off"}) to ${outputPath}`
  );
}

main().catch((error) => {
  console.error("[MacroIntel] fatal:", error);
  process.exitCode = 1;
});
