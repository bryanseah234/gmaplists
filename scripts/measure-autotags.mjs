import fs from "node:fs";
import { createServer } from "vite";

const vite = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "silent",
});

const { parseApiJson } = await vite.ssrLoadModule("/src/services/apiParserService.ts");
const { measureRuleCoverage } = await vite.ssrLoadModule("/src/services/autoTagMeasurement.ts");

const fixturePath = new URL("../fixtures/getlist-raw.json", import.meta.url);
const raw = fs.readFileSync(fixturePath, "utf8");
const parsed = JSON.parse(raw);
const topLevelIsArray = Array.isArray(parsed);
const topLevelLength = topLevelIsArray ? parsed.length : null;
const placeCount = Array.isArray(parsed?.[0]?.[8]) ? parsed[0][8].length : null;
const extracted = parseApiJson(`)]}'\n${JSON.stringify(parsed)}`);
const measurement = measureRuleCoverage(extracted.places);

const percent = (count, total) => total === 0 ? "0.0%" : `${((count / total) * 100).toFixed(1)}%`;
const familySummary = (place) => place.matched_families
  .map((match) => `${match.category}:${match.id}:${match.term}:${match.matchedOn}`)
  .join(" | ");

console.log(JSON.stringify({
  shape: { topLevelIsArray, topLevelLength, placeCount },
  total: measurement.total,
  categoryCoverage: Object.fromEntries(
    Object.entries(measurement.categoryCounts).map(([category, count]) => [
      category,
      { count, percent: percent(count, measurement.total) },
    ])
  ),
  confidenceCoverage: Object.fromEntries(
    Object.entries(measurement.confidenceCounts).map(([confidence, count]) => [
      confidence,
      { count, percent: percent(count, measurement.total) },
    ])
  ),
  unsortedNames: measurement.unsortedNames,
  multiFamilyMatches: measurement.multiFamilyMatches.map((place) => ({
    place_name: place.place_name,
    winner: place.category,
    confidence: place.confidence,
    rule_id: place.rule_id,
    resolution: place.resolution,
    matches: familySummary(place),
  })),
  addressFallbackOnly: measurement.addressFallbackOnly.map((place) => ({
    place_name: place.place_name,
    category: place.category,
    rule_id: place.rule_id,
    reason: place.reason,
    matches: familySummary(place),
  })),
  noteValidation: {
    labelledCount: measurement.noteValidation.labelledCount,
    excludedCount: measurement.noteValidation.excludedCount,
    correctCount: measurement.noteValidation.correctCount,
    accuracy: measurement.noteValidation.accuracy,
    mismatches: measurement.noteValidation.mismatches,
  },
}, null, 2));

await vite.close();
