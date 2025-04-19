import { Mistral } from '@mistralai/mistralai';
import { z } from 'zod';

const API_BASE_URL = 'https://api.mistral.ai/v1';
const TAGINFO_API = 'https://taginfo.openstreetmap.org/api/4';

const mistralClient = new Mistral({
  apiKey: import.meta.env.VITE_MISTRAL_API_KEY
});

interface SearchResult {
  coordinates: [number, number];
  display_name: string;
  osm_type: string;
  osm_id: number;
}

async function validateOsmTag(key: string, value: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TAGINFO_API}/tag/values?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}`
    );
    const data = await response.json();
    return data.data?.some((entry: any) => entry.value === value);
  } catch (error) {
    console.error('Tag validation failed:', error);
    return false;
  }
}

async function mapToOsmTags(term: string): Promise<{key: string, value: string} | null> {
  try {
    const response = await mistralClient.chat({
      model: 'mistral-large-latest',
      messages: [{
        role: 'user',
        content: `Map "${term}" to OpenStreetMap tags. Respond with JSON: {key: "...", value: "..."}`
      }]
    });
    
    const result = JSON.parse(response.choices[0].message.content);
    if (await validateOsmTag(result.key, result.value)) {
      return result;
    }
    return null;
  } catch (error) {
    console.error('AI mapping failed:', error);
    return null;
  }
}

const ParsedQuerySchema = z.object({
  searchTerm: z.string(),
  location: z.object({
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).optional(),
    radius: z.number().optional()
  }).optional(),
  filters: z.object({
    temporal: z.object({
      openNow: z.boolean().optional()
    }).optional()
  }).optional(),
  osmTags: z.array(z.object({
    key: z.string(),
    value: z.string()
  })).optional()
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

function buildNominatimQuery(parsedQuery: ParsedQuery): string {
  const params = new URLSearchParams();
  let searchTerms = [parsedQuery.searchTerm];

  // Add OSM tags
  if (parsedQuery.osm_tags?.specific) {
    searchTerms.push(`[${parsedQuery.osm_tags.specific.key}=${parsedQuery.osm_tags.specific.value}]`);
  }

  params.append('q', searchTerms.join(' '));

  // Add geographic context
  if (parsedQuery.location?.coordinates) {
    const { latitude, longitude } = parsedQuery.location.coordinates;
    const radius = parsedQuery.location.radius?.value || 5; // Default 5km radius
    const viewboxSize = radius * 0.02; // Approximate degree conversion
    
    params.append('viewbox', 
      `${longitude-viewboxSize},${latitude+viewboxSize},${longitude+viewboxSize},${latitude-viewboxSize}`
    );
    params.append('bounded', '1');
  }

  params.append('format', 'json');
  params.append('limit', '10');
  return params.toString();
}

// Enhanced searchLocations function
export async function searchLocations(query: string, userLocation?: { latitude: number; longitude: number }) {
  try {
    const parsedQuery = await parseSearchQuery(query, userLocation);
    const params = buildNominatimQuery(parsedQuery);
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`
    );

    if (!response.ok) throw new Error('Search failed');
    let results = await response.json();

    // Fallback for empty results
    if (results.length === 0) {
      const fallbackResponse = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10`
      );
      results = await fallbackResponse.json();
    }

    return results;

  } catch (error) {
    console.error('Search error:', error);
    // Final fallback with simplified query
    const fallbackResponse = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=3`
    );
    return fallbackResponse.json();
  }
}

// Enhanced error handling in parseSearchQuery
export async function parseSearchQuery(
  query: string, 
  userLocation?: { latitude: number; longitude: number }
): Promise<ParsedQuery> {
  try {
    const analysis = await mistralClient.chat({
      model: 'mistral-medium',
      messages: [{
        role: 'user',
        content: `Analyze search query: "${query}". Extract:
        - Primary search term
        - Location context (city/landmark or current location)
        - OSM tags (key=value)
        Respond with JSON: {
          searchTerm: string,
          location?: { type: 'current'|'specific', area?: string },
          osmTags?: {key: string, value: string}[]
        }`
      }]
    });

    const parsed = JSON.parse(analysis.choices[0].message.content);
    
    // Handle location context
    if (parsed.location?.type === 'current' && userLocation) {
      parsed.location.coordinates = userLocation;
      parsed.location.radius = { value: 5, unit: 'kilometers' };
    }

    return ParsedQuerySchema.parse(parsed);

  } catch (error) {
    console.error('AI parsing failed:', error);
    // Fallback logic
    return ParsedQuerySchema.parse({
      searchTerm: query,
      location: userLocation ? { 
        coordinates: userLocation,
        radius: { value: 5, unit: 'kilometers' }
      } : undefined,
      osmTags: await mapToOsmTags(query)
    });
  }
}