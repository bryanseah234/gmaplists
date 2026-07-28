import { describe, it, expect } from 'vitest';
import { flattenAndFind, parseApiJson } from '../apiParserService';

describe('apiParserService', () => {
  it('finds the first nested value matching a heuristic', () => {
    const nested = ['skip', [null, ['target', ['later']]]];
    expect(flattenAndFind(nested, (value) => value === 'target')).toBe('target');
  });

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

  it('keeps list-only extension data unsorted instead of guessing from names', () => {
    const mockJson = [
      [
        null, null, null, null, "No Detail List", null, null, null,
        [
          [null, null, "Chuo University Tama Campus", ""],
          [null, null, "Hidden Cocktail Bar", ""],
        ]
      ]
    ];
    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw);

    expect(result.places[0]).toMatchObject({
      primary_category: "Unsorted",
      detailed_category: "Unknown",
    });
    expect(result.places[1]).toMatchObject({
      primary_category: "Unsorted",
      detailed_category: "Unknown",
    });
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

  it('maps retail shop labels like Bag shop to Shop', () => {
    const mockJson = [
      [
        null, null, null, null, "Retail List", null, null, null,
        [
          [null, null, "The Bag Creature", ""]
        ]
      ]
    ];
    const mockMeta = [
      { __type: "Bag shop" }
    ];

    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw, mockMeta);

    expect(result.places[0].primary_category).toBe("Shop");
    expect(result.places[0].detailed_category).toBe("Bag shop");
  });

  it('persists coordinates, price, address, and heuristic detail fields', () => {
    const mockJson = [
      [
        [["list123"]],
        null,
        [null, null, "https://list.url"],
        null,
        "Rich Detail List",
        null,
        null,
        null,
        [
          [
            null,
            [
              null,
              null,
              "Nested Cafe, old address text",
              null,
              "123 Main St, Singapore",
              [null, null, 1.3521, 103.8198],
              ["https://www.google.com/maps/place/nested-cafe", "https://nested.example"],
              ["ChIJabcdef123456789"],
              ["+65 1234 5678"],
              ["CLOSED"],
            ],
            "Nested Cafe",
            "Try the lunch set",
            null,
            null,
            null,
            null,
            null,
            [1680000000],
          ],
        ],
      ],
    ];

    const mockMeta = [
      { __gcid: "gcid:cafe", __type: "Cafe", __rating: 4.6, __reviews: 42, __price: 2, __hexId: "0x1:0x2" },
    ];

    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = parseApiJson(raw, mockMeta);

    expect(result.places[0]).toMatchObject({
      place_name: "Nested Cafe",
      price_level: "$$",
      lat: 1.3521,
      lng: 103.8198,
      address: "123 Main St, Singapore",
      phone: "+65 1234 5678",
      website: "https://nested.example",
      google_place_id: "ChIJabcdef123456789",
      business_status: "CLOSED",
    });
  });

  it('does not use internal hex ids as Google place_id links', () => {
    const mockJson = [
      [
        [["list123"]],
        null,
        [null, null, "https://list.url"],
        null,
        "Hex Link List",
        null,
        null,
        null,
        [
          [
            null,
            [
              null,
              null,
              "Place address text",
              null,
              "10 Test Road",
              [null, null, 1.3, 103.8],
            ],
            "Hex Only Bar",
            "",
          ],
        ],
      ],
    ];

    const mockMeta = [
      { __hexId: "0x31da19b066f8cac9:0x1a822ab9ded25293" },
    ];

    const result = parseApiJson(")]}'\n" + JSON.stringify(mockJson), mockMeta);

    expect(result.places[0].google_maps_link).not.toContain("place_id:0x");
    expect(result.places[0].google_maps_link).toContain("/maps/search/");
  });
});
