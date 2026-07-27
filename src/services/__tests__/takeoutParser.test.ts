import { describe, expect, it } from 'vitest';
import { parseTakeoutJson, parseTakeoutPlaces } from '../takeoutParser';

describe('takeoutParser', () => {
  it('maps Saved Places GeoJSON features into Place objects', () => {
    const raw = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [103.8198, 1.3521] },
          properties: {
            'Google Maps URL': 'https://www.google.com/maps/place/?q=place_id:ChIJabcdef123',
            Location: {
              'Business Name': 'Takeout Cafe',
              Address: '123 Main St, Singapore',
            },
          },
        },
      ],
    });

    const places = parseTakeoutPlaces(raw);

    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      place_name: 'Takeout Cafe',
      google_maps_link: 'https://www.google.com/maps/place/?q=place_id:ChIJabcdef123',
      google_place_id: 'ChIJabcdef123',
      address: '123 Main St, Singapore',
      lat: 1.3521,
      lng: 103.8198,
      primary_category: 'Unsorted',
      detailed_category: 'Google Takeout',
    });
    expect(places[0].hex_place_id).toMatch(/^0x[0-9a-f]{16}:0x[0-9a-f]{16}$/);
  });

  it('returns ExtractedData with a deterministic takeout list id', () => {
    const raw = JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          geometry: { coordinates: [0, 0] },
          properties: {
            Location: { 'Business Name': 'Zero Coordinate Place' },
          },
        },
      ],
    });

    const result = parseTakeoutJson(raw, 'Saved Places.json');

    expect(result.list_title).toBe('Saved Places');
    expect(result.list_id).toMatch(/^takeout-[0-9a-f]{12}$/);
    expect(result.places[0].list_id).toBe(result.list_id);
    expect(result.places[0].lat).toBe(0);
    expect(result.places[0].lng).toBe(0);
  });
});
