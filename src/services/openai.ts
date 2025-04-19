import OpenAI from 'openai';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

// Zod schema for validation
const ParsedQuerySchema = z.object({
  searchTerm: z.string(),
  location: z.object({
    area: z.string().optional(),
    coordinates: z.object({
      latitude: z.number().optional(),
      longitude: z.number().optional()
    }).optional()
  }).optional(),
  context: z.object({
    type: z.enum(['restaurant', 'hotel', 'cafe', 'park', 'landmark', 'store', 'other']).optional(),
    filters: z.object({
      cuisine: z.string().array().optional(),
      priceRange: z.enum(['low', 'medium', 'high', 'luxury']).optional(),
      openNow: z.boolean().optional(),
      rating: z.number().min(0).max(5).optional(),
      amenities: z.string().array().optional(),
      distance: z.object({
        value: z.number(),
        unit: z.enum(['miles', 'kilometers'])
      }).optional()
    }).optional()
  }).optional()
});

export type ParsedQuery = z.infer<typeof ParsedQuerySchema>;

const SYSTEM_PROMPT = `
You are an advanced location search assistant. Analyze user queries and extract:

1. Primary search term (e.g., "coffee shops", "parks")
2. Location context (type: restaurant, hotel, etc.)
3. Detailed filters:
   - Cuisine types (Italian, Asian fusion, etc.)
   - Price range (low, medium, high, luxury)
   - Open status
   - Rating thresholds
   - Amenities (wifi, parking, etc.)
   - Distance/radius preferences
4. Geographic context (neighborhoods, landmarks, or coordinates)

Respond in JSON format matching this structure:
{
  "searchTerm": "main search term",
  "location": {
    "area": "specific neighborhood or city area",
    "coordinates": { "latitude": 0.0, "longitude": 0.0 } // only if provided
  },
  "context": {
    "type": "category",
    "filters": {
      "cuisine": ["types"],
      "priceRange": "range",
      "openNow": boolean,
      "rating": minimum_rating,
      "amenities": ["list"],
      "distance": { "value": number, "unit": "miles/kilometers" }
    }
  }
}

Examples:
User: "Find pet-friendly cafes with wifi near Central Park open now"
Response: {
  "searchTerm": "cafes",
  "location": { "area": "Central Park" },
  "context": {
    "type": "cafe",
    "filters": {
      "openNow": true,
      "amenities": ["wifi", "pet-friendly"]
    }
  }
}

User: "Affordable sushi restaurants with 4+ rating within 2 miles"
Response: {
  "searchTerm": "sushi restaurants",
  "context": {
    "type": "restaurant",
    "filters": {
      "priceRange": "medium",
      "rating": 4,
      "distance": { "value": 2, "unit": "miles" }
    }
  }
}
`;

export async function parseSearchQuery(query: string, userLocation?: { latitude: number; longitude: number }): Promise<ParsedQuery> {
  try {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: query
      }
    ];

    if (userLocation) {
      messages.push({
        role: "assistant",
        content: `User current location: ${JSON.stringify(userLocation)}`
      });
    }

    const completion = await openai.chat.completions.create({
      messages,
      model: "o3-mini",
      reasoning_effort: "medium",
      response_format: { type: "json_object" },
      temperature: 0.6,
    });

    const result = completion.choices[0].message.content;
    if (!result) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(result);
    const validation = ParsedQuerySchema.safeParse(parsed);

    if (!validation.success) {
      console.warn('Validation errors:', validation.error.format());
      return {
        searchTerm: query,
        ...(userLocation && { location: { coordinates: userLocation } })
      };
    }

    return {
      ...validation.data,
      location: {
        ...validation.data.location,
        ...(userLocation && { coordinates: userLocation })
      }
    };
  } catch (error) {
    console.error('Error parsing query:', error);
    return {
      searchTerm: query,
      ...(userLocation && { location: { coordinates: userLocation } })
    };
  }
}