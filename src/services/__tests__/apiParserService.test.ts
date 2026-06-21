import { describe, it, expect } from 'vitest';
import { parseApiJson } from '../apiParserService';

describe('apiParserService', () => {
  it('parses valid JSON list data', () => {
    const mockJson = [
      [
        [["list123"]],
        null,
        [null, null, "https://list.url"],
        null,
        "My Test List",
        null,
        null,
        null,
        [
          [null, null, "Ramen Restaurant A", "Best ramen", null, null, null, null, null, [1680000000000]],
          [null, null, "Park B", "Nice view", null, null, null, null, null, [1680000000000]]
        ]
      ]
    ];
    
    const mockMeta = [
      { __gcid: "gcid:ramen_restaurant", __type: "Ramen restaurant", __rating: 4.8, __reviews: 120 },
      { __gcid: "gcid:park", __type: "Park", __rating: 4.5, __reviews: 300 }
    ];

    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw, mockMeta);

    expect(result.list_title).toBe("My Test List");
    expect(result.places).toHaveLength(2);
    
    expect(result.places[0].place_name).toBe("Ramen Restaurant A");
    expect(result.places[0].user_notes).toBe("Best ramen");
    expect(result.places[0].primary_category).toBe("Food");
    expect(result.places[0].star_rating).toBe(4.8);
    expect(result.places[0].review_count).toBe(120);
    
    expect(result.places[1].place_name).toBe("Park B");
    expect(result.places[1].primary_category).toBe("See");
  });

  it('handles missing meta array gracefully', () => {
    const mockJson = [
      [
        null, null, null, null, "No Meta List", null, null, null,
        [
          [null, null, "Unknown Place", ""]
        ]
      ]
    ];
    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw);
    
    expect(result.places).toHaveLength(1);
    expect(result.places[0].primary_category).toBe("Unsorted");
  });
  
  it('falls back gracefully if JSON.parse fails', () => {
    const raw = "invalid json";
    const result = parseApiJson(raw);
    expect(result.places).toHaveLength(0);
    expect(result.list_title).toBe("My List");
  });

  it('correctly maps coffee shop to Snack and bar to Drink', () => {
    const mockJson = [
      [
        null, null, null, null, "List", null, null, null,
        [
          [null, null, "Starbucks", ""],
          [null, null, "Irish Pub", ""]
        ]
      ]
    ];
    const mockMeta = [
      { __gcid: "gcid:coffee_shop", __type: "Coffee Shop" },
      { __gcid: "gcid:bar", __type: "Bar" }
    ];

    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw, mockMeta);

    expect(result.places[0].primary_category).toBe("Snack");
    expect(result.places[1].primary_category).toBe("Drink");
  });
});
