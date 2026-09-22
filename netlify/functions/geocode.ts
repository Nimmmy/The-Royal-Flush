import type { Config, Context } from '@netlify/functions';
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { json, storeName } from './_shared/storage';
import type { GeoResult } from '../../src/types';

type Cache = { results: GeoResult[]; expires: number };
type Feature = { geometry?: { coordinates?: number[] }; properties?: Record<string, string | number> };

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  const q = (new URL(request.url).searchParams.get('q') || '').trim().replace(/\s+/g, ' ');
  if (q.length < 3 || q.length > 250) return json({ error: 'Enter an address or place with 3–250 characters.' }, 400);
  try {
    const cache = getStore({ name: storeName(context, 'geocoding'), consistency: 'strong' });
    const provider = Netlify.env.get('PHOTON_BASE_URL') || 'https://photon.komoot.io';
    const key = createHash('sha256').update(provider + q.toLowerCase()).digest('hex');
    const hit = await cache.get(key, { type: 'json' }) as Cache | null;
    if (hit && hit.expires > Date.now()) return json({ results: hit.results });
    const url = new URL('/api/', provider);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '5');
    url.searchParams.set('lang', 'en');
    const response = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json', 'User-Agent': 'TheRoyalFlush/1.0 (+https://the-royal-flush.netlify.app)' } });
    if (!response.ok) throw new Error('Geocoder unavailable');
    const body = await response.json() as { features?: Feature[] };
    if (!Array.isArray(body.features)) throw new Error('Invalid geocoder response');
    const results: GeoResult[] = [];
    for (const feature of body.features) {
      const coordinates = feature.geometry?.coordinates;
      const p = feature.properties || {};
      if (!coordinates || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1])) continue;
      const street = [p.housenumber, p.street].filter(Boolean).join(' ');
      const displayName = [...new Set([p.name, street, p.city || p.town || p.village || p.county, p.state, p.postcode, p.country].filter(Boolean))].join(', ');
      if (!displayName || displayName.length > 250) continue;
      if (results.some(r => r.displayName === displayName && r.latitude === coordinates[1] && r.longitude === coordinates[0])) continue;
      results.push({ displayName, latitude: coordinates[1], longitude: coordinates[0] });
    }
    await cache.setJSON(key, { results, expires: Date.now() + 86400000 });
    return json({ results });
  } catch {
    return json({ error: 'Address search is unavailable right now. Please try again in a moment.' }, 503);
  }
};
export const config: Config = {
  path: '/api/geocode',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
