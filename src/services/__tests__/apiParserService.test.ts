import { describe, it, expect } from 'vitest';
import { flattenAndFind, parseApiJson } from '../apiParserService';

function getlistPlace({
  name,
  label,
  address,
  note = "",
  featureId = ["9000000000000000001", "9000000000000000002"],
}: {
  name: string;
  label?: string;
  address?: string;
  note?: string;
  featureId?: [string, string];
}) {
  return [
    null,
    [
      null,
      null,
      label,
      null,
      address,
      [null, null, 1.5140387, 103.6551804],
      featureId,
      "/g/11z8k42n7f",
    ],
    name,
    note,
    null,
    null,
    null,
    null,
    [[1], featureId],
    [1786159254, 396798000],
    [1786159254, 396798000],
  ];
}

function listJson(places: unknown[]) {
  return [
    [
      ["list123", 1, null, 1, 1],
      2,
      [3, 1, "https://www.google.com/maps/placelists/list/list123"],
      null,
      "My Test List",
      null,
      null,
      null,
      places,
      null,
      [1700000000, 0],
      [1700000000, 0],
      places.length,
    ],
  ];
}

describe('apiParserService', () => {
  it('finds the first nested value matching a heuristic', () => {
    const nested = ['skip', [null, ['target', ['later']]]];
    expect(flattenAndFind(nested, (value) => value === 'target')).toBe('target');
  });

  it('parses the real getlist shape without invented category metadata', () => {
    const raw = ")]}'\n" + JSON.stringify(listJson([
      getlistPlace({
        name: "DUDU DUCK CAFE",
        label: "Lot L1-078, DUDU DUCK CAFE, Tasek Central Mall, Skudai, Johor, Malaysia",
        address: "Lot L1-078, Tasek Central Mall, Skudai, Johor, Malaysia",
        note: "Butter",
      }),
    ]));

    const result = parseApiJson(raw, [{
      __lat: 1.5140387,
      __lng: 103.6551804,
      __address: "Lot L1-078, Tasek Central Mall, Skudai, Johor, Malaysia",
      __hexId: "0x31da19b066f8cac9:0x2b5f2f8ea19dcbf6",
    }]);

    expect(result.list_title).toBe("My Test List");
    expect(result.places).toHaveLength(1);
    expect(result.places[0]).toMatchObject({
      place_name: "DUDU DUCK CAFE",
      primary_category: "Snack",
      detailed_category: "Rule: snack.sweets.bakery.note",
      user_notes: "Butter",
      lat: 1.5140387,
      lng: 103.6551804,
      address: "Lot L1-078, Tasek Central Mall, Skudai, Johor, Malaysia",
      place_label: "Lot L1-078, DUDU DUCK CAFE, Tasek Central Mall, Skudai, Johor, Malaysia",
      hex_place_id: "0x31da19b066f8cac9:0x2b5f2f8ea19dcbf6",
      feature_id: "9000000000000000001:9000000000000000002",
      added_at: 1786159254,
    });
  });

  it('falls back gracefully if JSON.parse fails', () => {
    const result = parseApiJson("invalid json");
    expect(result.places).toHaveLength(0);
    expect(result.list_title).toBe("My List");
  });

  it('persists optional detail fields that are live on extension payloads', () => {
    const raw = ")]}'\n" + JSON.stringify(listJson([
      getlistPlace({
        name: "Nested Cafe",
        label: "Nested Cafe, old address text",
        address: "123 Main St, Singapore",
      }),
    ]));

    const result = parseApiJson(raw, [{
      __rating: 4.6,
      __reviews: 42,
      __price: 2,
      __hexId: "0x1:0x2",
    }]);

    expect(result.places[0]).toMatchObject({
      place_name: "Nested Cafe",
      primary_category: "Snack",
      detailed_category: "Rule: snack.sweets.bakery",
      price_level: "$$",
      lat: 1.5140387,
      lng: 103.6551804,
      address: "123 Main St, Singapore",
      star_rating: 4.6,
      review_count: 42,
    });
  });

  it('does not use internal hex ids as Google place_id links', () => {
    const raw = ")]}'\n" + JSON.stringify(listJson([
      getlistPlace({
        name: "Hex Only Bar",
        label: "Place address text",
        address: "10 Test Road",
      }),
    ]));

    const result = parseApiJson(raw, [{ __hexId: "0x31da19b066f8cac9:0x1a822ab9ded25293" }]);

    expect(result.places[0].google_maps_link).not.toContain("place_id:0x");
    expect(result.places[0].google_maps_link).toContain("/maps/search/");
  });

  it('uses committed static tags before local rules', () => {
    const raw = ")]}'\n" + JSON.stringify(listJson([
      getlistPlace({
        name: "Blackbyrd KL",
        label: "Blackbyrd KL",
        address: "Kuala Lumpur",
        featureId: ["3588304369080315123", "8871540845564433213"],
      }),
    ]));

    const result = parseApiJson(raw);

    expect(result.places[0]).toMatchObject({
      place_name: "Blackbyrd KL",
      primary_category: "Food",
      detailed_category: "Static tag (medium)",
      feature_id: "3588304369080315123:8871540845564433213",
    });
  });

  it('strips contributor profile slots before parsing getlist rows', () => {
    const placeWithContributor = getlistPlace({
      name: "Privacy Test Cafe",
      label: "Privacy Test Cafe",
      address: "123 Test Road",
    });
    placeWithContributor[12] = ["Display Name", "https://lh3.googleusercontent.com/avatar", "account-id"];

    const raw = ")]}'\n" + JSON.stringify(listJson([
      placeWithContributor,
    ]));

    const result = parseApiJson(raw);

    expect(result.places).toHaveLength(1);
    expect(JSON.stringify(result.places[0])).not.toContain("account-id");
    expect(JSON.stringify(result.places[0])).not.toContain("googleusercontent.com/avatar");
  });
});
