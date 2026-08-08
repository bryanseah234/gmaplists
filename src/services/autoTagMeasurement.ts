import { Place } from "../types";
import { AutoTagCategory, categoryFromFoodDescriptiveNote, classifyPlaceByRules } from "./categoryRules";

export interface MeasuredPlace {
  feature_id?: string;
  place_name: string;
  category: AutoTagCategory;
  confidence: string;
  rule_id: string;
  reason: string;
}

export interface NoteValidationResult {
  labelledCount: number;
  excludedCount: number;
  correctCount: number;
  accuracy: number | null;
  mismatches: Array<{
    place_name: string;
    note: string;
    expected: AutoTagCategory;
    actual: AutoTagCategory;
  }>;
}

export interface RuleMeasurementResult {
  total: number;
  taggedCount: number;
  unsortedCount: number;
  taggedPercent: number;
  unsortedPercent: number;
  unsortedNames: string[];
  places: MeasuredPlace[];
  noteValidation: NoteValidationResult;
}

function roundPercent(count: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function classifyPlacesForMeasurement(places: Place[]): MeasuredPlace[] {
  return places.map((place) => {
    const result = classifyPlaceByRules({
      displayName: place.place_name,
      placeLabel: place.place_label,
      address: place.address,
      userNote: place.user_notes,
    });

    return {
      feature_id: place.feature_id,
      place_name: place.place_name,
      category: result.category,
      confidence: result.confidence,
      rule_id: result.ruleId,
      reason: result.reason,
    };
  });
}

export function validateAgainstFoodNotes(places: Place[], measured: MeasuredPlace[]): NoteValidationResult {
  const byFeatureId = new Map(measured.filter((place) => place.feature_id).map((place) => [place.feature_id, place]));
  const byName = new Map(measured.map((place) => [place.place_name, place]));
  let excludedCount = 0;
  let correctCount = 0;
  const mismatches: NoteValidationResult["mismatches"] = [];

  for (const place of places) {
    if (!place.user_notes?.trim()) continue;

    const expected = categoryFromFoodDescriptiveNote(place.user_notes);
    if (!expected) {
      excludedCount += 1;
      continue;
    }

    const actual = (place.feature_id ? byFeatureId.get(place.feature_id) : undefined) ?? byName.get(place.place_name);
    if (actual?.category === expected) {
      correctCount += 1;
    } else {
      mismatches.push({
        place_name: place.place_name,
        note: place.user_notes,
        expected,
        actual: actual?.category ?? "Unsorted",
      });
    }
  }

  const labelledCount = correctCount + mismatches.length;
  return {
    labelledCount,
    excludedCount,
    correctCount,
    accuracy: labelledCount === 0 ? null : correctCount / labelledCount,
    mismatches,
  };
}

export function measureRuleCoverage(places: Place[]): RuleMeasurementResult {
  const measured = classifyPlacesForMeasurement(places);
  const unsortedNames = measured
    .filter((place) => place.category === "Unsorted")
    .map((place) => place.place_name)
    .sort((a, b) => a.localeCompare(b));
  const unsortedCount = unsortedNames.length;
  const taggedCount = measured.length - unsortedCount;

  return {
    total: measured.length,
    taggedCount,
    unsortedCount,
    taggedPercent: roundPercent(taggedCount, measured.length),
    unsortedPercent: roundPercent(unsortedCount, measured.length),
    unsortedNames,
    places: measured,
    noteValidation: validateAgainstFoodNotes(places, measured),
  };
}
