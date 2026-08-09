const CONTRIBUTOR_INDEX = 12;

function hasContributorSlot(place: unknown): boolean {
  return Array.isArray(place) && place.length > CONTRIBUTOR_INDEX && place[CONTRIBUTOR_INDEX] != null;
}

export function stripContributorProfilesFromGetlist(data: unknown): unknown {
  if (!Array.isArray(data)) return data;
  const cloned = structuredClone(data);
  const places = cloned?.[0]?.[8];
  if (!Array.isArray(places)) return cloned;

  for (const place of places) {
    if (Array.isArray(place) && place.length > CONTRIBUTOR_INDEX) {
      place[CONTRIBUTOR_INDEX] = null;
    }
  }

  return cloned;
}

export function assertContributorProfilesStrippedFromGetlist(data: unknown): void {
  const places = Array.isArray(data) ? data?.[0]?.[8] : undefined;
  if (!Array.isArray(places)) return;

  const leakingIndex = places.findIndex(hasContributorSlot);
  if (leakingIndex >= 0) {
    throw new Error(`Contributor profile data was not stripped from getlist place index ${leakingIndex}.`);
  }
}

export function assertPlaceRecordsContainNoContributorData(records: unknown[]): void {
  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const keys = Object.keys(record);
    const leakKey = keys.find((key) => /contributor|avatar|account/i.test(key));
    if (leakKey) {
      throw new Error(`Contributor-like field "${leakKey}" cannot be persisted.`);
    }
  }
}
