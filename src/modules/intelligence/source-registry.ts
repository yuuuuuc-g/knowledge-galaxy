import sourcesJson from "@/config/intelligence-sources.json";

export type IntelligenceModuleId = "daily-briefing" | "macro-intel" | "apac-supply-chain";

export interface IntelligenceSource {
  id: string;
  name: string;
  url: string;
  modules: IntelligenceModuleId[];
  regions: string[];
  topics: string[];
}

function isIntelligenceModuleId(value: unknown): value is IntelligenceModuleId {
  return value === "daily-briefing" || value === "macro-intel" || value === "apac-supply-chain";
}

function isIntelligenceSource(value: unknown): value is IntelligenceSource {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<IntelligenceSource>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.url === "string" &&
    Array.isArray(candidate.modules) &&
    candidate.modules.every(isIntelligenceModuleId) &&
    Array.isArray(candidate.regions) &&
    candidate.regions.every((region) => typeof region === "string") &&
    Array.isArray(candidate.topics) &&
    candidate.topics.every((topic) => typeof topic === "string")
  );
}

export function getAllIntelligenceSources(): IntelligenceSource[] {
  if (!Array.isArray(sourcesJson) || !sourcesJson.every(isIntelligenceSource)) {
    throw new Error("Invalid intelligence source registry.");
  }

  return sourcesJson;
}

export function getIntelligenceSourcesForModule(moduleId: IntelligenceModuleId): IntelligenceSource[] {
  return getAllIntelligenceSources().filter((source) => source.modules.includes(moduleId));
}
