import tagsData from "../data/tags.json";
import { AutoTagCategory, AutoTagConfidence } from "./categoryRules";

export interface StaticTag {
  category: AutoTagCategory;
  confidence: AutoTagConfidence;
  reason: string;
}

const tags = tagsData as Record<string, StaticTag>;

export function getStaticTag(featureId?: string): StaticTag | undefined {
  if (!featureId) return undefined;
  return tags[featureId];
}
