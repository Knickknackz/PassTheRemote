import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, jsonResponse, isAuthorized } from '../_shared/utils.ts';
// @ts-expect-error esm.sh may not provide types for this SDK, but runtime import works in Deno
import * as streamingAvailability from "https://esm.sh/streaming-availability@4.4.0";

// @ts-expect-error Deno.env.get is available at runtime in Supabase Edge Functions
const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');
// @ts-expect-error Deno.env.get is available at runtime in Supabase Edge Functions
const REACTR_EXTENSION_SECRET = Deno.env.get('REACTR_EXTENSION_SECRET');

if (!RAPIDAPI_KEY || !REACTR_EXTENSION_SECRET) {
  throw new Error("Missing required environment variables for API communication.");
}

type PlatformStream = {
  type: string;
  link: string;
  videoLink: string | null;
  quality: string | null;
  expiresSoon: boolean;
  expiresOn?: number;
};

function normalizeStreamingOptions(streamingOptions: Record<string, streamingAvailability.StreamingOption[]>) {
  const platformStreams: Record<string, PlatformStream> = {};
  const availabilityByPlatform: Record<string, string[]> = {};

  for (const [countryCode, entries] of Object.entries(streamingOptions)) {
    for (const entry of entries) {
      const type = entry.type;
      if (!['subscription', 'addon'].includes(type)) continue;

      let platformId: string | undefined;
      if (type === 'addon' && entry.addon?.name) {
        platformId = entry.addon.name.toLowerCase();
      } else if (entry.service?.name) {
        platformId = entry.service.name.toLowerCase();
      }
      if (!platformId) continue;

      if (!availabilityByPlatform[platformId]) availabilityByPlatform[platformId] = [];
      if (!availabilityByPlatform[platformId].includes(countryCode)) {
        availabilityByPlatform[platformId].push(countryCode);
      }

      if (!platformStreams[platformId]) {
        platformStreams[platformId] = {
          type: entry.type,
          link: entry.link,
          videoLink: entry.videoLink || null,
          quality: entry.quality || null,
          expiresSoon: !!entry.expiresSoon,
          ...(entry.expiresSoon && entry.expiresOn ? { expiresOn: entry.expiresOn } : {}),
          ...(entry.type === 'addon' ? {serviceName : entry.service.name} : {}),
          ...(entry.type === 'addon' ? {addOnName : entry.addon.name} : {})
        };
      }
    }
  }

  return { availabilityByPlatform, platformStreams };
}

function extractExpires(url: string): number | null {
  const match = url.match(/Expires=(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function findEarliestExpiration(imageSet: unknown): number | null {
  const set = imageSet as { verticalPoster?: Record<string, string>; horizontalPoster?: Record<string, string>; horizontalBackdrop?: Record<string, string> };
  const urls: string[] = [
    ...Object.values(set?.verticalPoster || {}),
    ...Object.values(set?.horizontalPoster || {}),
    ...Object.values(set?.horizontalBackdrop || {}),
  ].filter((v): v is string => typeof v === 'string');
  const expires = urls.map(extractExpires).filter((e): e is number => typeof e === 'number');
  return expires.length > 0 ? Math.min(...expires) : null;
}

serve(async (req) => {
  const corsResult = handleCors(req);
  if (corsResult) return corsResult;

  if (!isAuthorized(req, REACTR_EXTENSION_SECRET)) {
    console.error('❌ Unauthorized request');
    return jsonResponse('Unauthorized', 401);
  }

  const { title } = await req.json();
  if (!title) return jsonResponse('Missing title', 400);

  try {
    const client = new streamingAvailability.Client(
      new streamingAvailability.Configuration({ apiKey: RAPIDAPI_KEY! })
    );
    // Search for both movies and series in one call, only country is required
    const results = await client.showsApi.searchShowsByTitle({ title, country: 'us' });
    const data = Array.isArray(results) ? results : results ? [results] : [];
    const result = data[0];

    if (!result) {
      return jsonResponse({ found: false }, 200);
    }

    const expiresAt = findEarliestExpiration(result.imageSet);
    const expires_at = expiresAt ? new Date(expiresAt * 1000).toISOString() : null;
    const { availabilityByPlatform, platformStreams } = normalizeStreamingOptions(result.streamingOptions);

    const meta = {
      found: true,
      title: result.title,
      overview: result.overview,
      year: result.firstAirYear ?? 9999,
      genres: result.genres?.map((g: { name: string }) => g.name),
      posters: {
        vertical: result.imageSet?.verticalPoster || {},
        horizontal: result.imageSet?.horizontalPoster || {},
        backdrop: result.imageSet?.horizontalBackdrop || {},
      },
      expires_at,
      availability_by_platform: availabilityByPlatform,
      platform_streams: platformStreams,
      imdb_id: result.imdbId || null
    };

    console.log(`Metadata retrieved for title: ${result.title}`);
    return jsonResponse(meta, 200);

  } catch (err) {
    console.error('❌ Metadata fetch failed:', err);
    return jsonResponse('An error occurred while fetching metadata', 500);
  }
});
