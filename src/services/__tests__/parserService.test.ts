import { describe, it, expect } from 'vitest';
import { parseListText, parseMapData } from '../parserService';

describe('parserService', () => {
  it('parses raw pipe-separated DOM text', async () => {
    const rawText = `Some random title
My Place Name | 4.5 | (100) | Cocktail bar | 123 Main St
Another Place | 3.0 | (50) | Park | 456 Elm St
`;
    const result = await parseMapData(rawText);
    
    expect(result.places).toHaveLength(2);
    expect(result.places[0].place_name).toBe("My Place Name");
    expect(result.places[0].star_rating).toBe(4.5);
    expect(result.places[0].review_count).toBe(100);
    expect(result.places[0].primary_category).toBe("Drink");
    
    expect(result.places[1].place_name).toBe("Another Place");
    expect(result.places[1].star_rating).toBe(3.0);
    expect(result.places[1].review_count).toBe(50);
    expect(result.places[1].primary_category).toBe("See");
  });

  it('sets structured API-only fields to undefined for raw text parsing', async () => {
    const rawText = `Place With Sparse Text | 4.2 | (15) | Cafe`;
    const result = await parseListText(rawText);

    expect(result.places[0]).toMatchObject({
      price_level: undefined,
      lat: undefined,
      lng: undefined,
      address: undefined,
      phone: undefined,
      website: undefined,
      google_place_id: undefined,
      business_status: undefined,
    });
  });

  it('delegates to parseApiJson if input is JSON', async () => {
    const mockJson = [
      [
        null, null, null, null, "Delegated List", null, null, null,
        [
          [null, null, "Json Place", ""]
        ]
      ]
    ];
    const raw = ")]}'\n" + JSON.stringify(mockJson);
    const result = await parseMapData(raw);
    expect(result.list_title).toBe("Delegated List");
    expect(result.places).toHaveLength(1);
    expect(result.places[0].place_name).toBe("Json Place");
  });

  it('extracts Google Maps link correctly', async () => {
    const rawText = `Test
Place With Link | [LINK:https://goo.gl/maps/abc] | 4.0 | (10) | Store
`;
    const result = await parseMapData(rawText);
    expect(result.places).toHaveLength(1);
    expect(result.places[0].google_maps_link).toBe("https://goo.gl/maps/abc");
    expect(result.places[0].primary_category).toBe("Shop"); // 'Store' -> 'Shop'
  });
});
