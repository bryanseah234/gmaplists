import { Place } from "../types";
import { classifyPlaceByRules } from "./categoryRules";
import { getStaticTag } from "./staticTags";

export function resolveAutoTag(place: Pick<Place, "place_name" | "place_label" | "address" | "user_notes" | "feature_id">) {
  const staticTag = getStaticTag(place.feature_id);
  if (staticTag) {
    return {
      category: staticTag.category,
      detailedCategory: `Static tag (${staticTag.confidence})`,
    };
  }

  const ruleTag = classifyPlaceByRules({
    displayName: place.place_name,
    placeLabel: place.place_label,
    address: place.address,
    userNote: place.user_notes,
  });

  return {
    category: ruleTag.category,
    detailedCategory: ruleTag.category === "Unsorted" ? "Unknown" : `Rule: ${ruleTag.ruleId}`,
  };
}

export function applyAutoTags(places: Place[]): Place[] {
  return places.map((place) => {
    const tag = resolveAutoTag(place);
    return {
      ...place,
      primary_category: tag.category,
      detailed_category: tag.detailedCategory,
      is_override: false,
    };
  });
}
