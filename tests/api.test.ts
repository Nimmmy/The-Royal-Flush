import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '@netlify/functions';
import type { Restroom } from '../src/types';
import { validateRestroom } from '../src/lib/validation';

const { records, storeOptions, storage } = vi.hoisted(() => {
  const records = new Map<string, unknown>();
  const storeOptions: unknown[] = [];
  const storage = {
    setJSON: vi.fn(async (key: string, value: unknown) => { records.set(key, value); }),
    get: vi.fn(async (key: string) => records.get(key) || null),
    getMetadata: vi.fn(async () => null),
    list: vi.fn(async function* () { yield { blobs: [...records.keys()].filter(k => k.startsWith('restrooms/')).map(key => ({ key })) }; }),
  };
  return { records, storeOptions, storage };
});
vi.mock('@netlify/blobs', () => ({ getStore: (options: unknown) => { storeOptions.push(options); return storage; } }));
import handler from '../netlify/functions/restrooms';
import geocode from '../netlify/functions/geocode';
import health from '../netlify/functions/health';
import { storeName } from '../netlify/functions/_shared/storage';

const context = { deploy: { context: 'production', published: true, id: 'a' }, requestId: 'test' } as Context;
const input = { locationName: '  Arcadia County Park  ', address: '405 South Santa Anita Avenue, Arcadia, CA', latitude: 34.133, longitude: -118.035, mensCode: '  #2468 ', womensCode: ' ', rating: 4, notes: ' Community review. ' };
const post = (body: unknown) => new Request('https://example.test/api/restrooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { records.clear(); storeOptions.length = 0; vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('public submission validation and persistence', () => {
  it.each([
    { locationName: '' }, { locationName: 'a'.repeat(121) }, { address: 'no' }, { address: 'a'.repeat(251) },
    { latitude: 91 }, { latitude: '34.1' }, { longitude: -181 }, { rating: 0 }, { rating: 6 }, { rating: 3.5 },
    { mensCode: 'x'.repeat(51) }, { womensCode: {} }, { notes: 'x'.repeat(1001) }, { notes: '<script>alert(1)</script>' },
  ])('rejects malformed fields %j without storing anything', async patch => {
    const response = await handler(post({ ...input, ...patch }), context);
    expect(response.status).toBe(400); expect(records.size).toBe(0);
    expect(Object.keys((await response.json()).errors).length).toBeGreaterThan(0);
  });
  it('normalizes fields, ignores client IDs/timestamps, and shares saved data in GET', async () => {
    const response = await handler(post({ ...input, id: 'spoof', createdAt: 'spoof', updatedAt: 'spoof' }), context);
    expect(response.status).toBe(201);
    const { restroom } = await response.json() as { restroom: Restroom };
    expect(restroom.id).toMatch(/^[\da-f-]{36}$/); expect(restroom.createdAt).not.toBe('spoof');
    expect(restroom.locationName).toBe('Arcadia County Park'); expect(restroom.mensCode).toBe('#2468'); expect(restroom.womensCode).toBeNull();
    expect(restroom.notes).toBe('Community review.'); expect(records.has(`restrooms/${restroom.id}`)).toBe(true);
    const otherRequest = await handler(new Request('https://example.test/api/restrooms'), context);
    expect((await otherRequest.json()).restrooms).toEqual([restroom]);
    expect(otherRequest.headers.get('cache-control')).toBe('no-store');
    expect(storeOptions).toContainEqual({ name: 'royal-flush-restrooms', consistency: 'strong' });
  });
  it('keeps simultaneous writes in separate UUID objects', async () => {
    const responses = await Promise.all(Array.from({ length: 12 }, (_, n) => handler(post({ ...input, locationName: `Park ${n}` }), context)));
    expect(responses.every(r => r.status === 201)).toBe(true); expect(records.size).toBe(12);
  });
  it('isolates draft and local stores, and preserves the production store across deploy IDs', () => {
    expect(storeName(context)).toBe('royal-flush-restrooms');
    expect(storeName({ deploy: { ...context.deploy, id: 'b' } })).toBe('royal-flush-restrooms');
    expect(storeName({ deploy: { ...context.deploy, published: false } })).toBe('royal-flush-restrooms-development');
    expect(storeName({ deploy: { ...context.deploy, context: 'dev' } })).toBe('royal-flush-restrooms-development');
  });
  it('handles malformed JSON, large payloads, wrong methods and content types', async () => {
    expect((await handler(new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }), context)).status).toBe(400);
    expect((await handler(post({ notes: 'x'.repeat(17000) }), context)).status).toBe(413);
    expect((await handler(new Request('https://example.test', { method: 'DELETE' }), context)).status).toBe(405);
    expect((await handler(new Request('https://example.test', { method: 'POST', body: 'text' }), context)).status).toBe(415);
    expect(validateRestroom(null).data).toBeUndefined(); expect(validateRestroom([]).data).toBeUndefined();
  });
  it('returns a friendly error when a write fails', async () => {
    storage.setJSON.mockRejectedValueOnce(new Error('private storage failure'));
    const response = await handler(post(input), context);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('private storage failure');
  });
});

describe('geocoding and health', () => {
  it('formats Photon results, caches searches and returns consistent coordinates', async () => {
    vi.stubGlobal('Netlify', { env: { get: () => undefined } });
    const fetchMock = vi.fn(async () => Response.json({ features: [{ geometry: { coordinates: [-118.263, 34.126] }, properties: { name: 'Costco', housenumber: '2901', street: 'Los Feliz Boulevard', city: 'Los Angeles', state: 'California', country: 'United States' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('https://example.test/api/geocode?q=Costco%20Los%20Feliz');
    const result = await geocode(request, context); expect(result.status).toBe(200);
    expect((await result.json()).results[0]).toEqual({ displayName: 'Costco, 2901 Los Feliz Boulevard, Los Angeles, California, United States', latitude: 34.126, longitude: -118.263 });
    await geocode(request, context); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('handles short searches and geocoder failure without leaking details', async () => {
    expect((await geocode(new Request('https://example.test/api/geocode?q=ab'), context)).status).toBe(400);
    vi.stubGlobal('Netlify', { env: { get: () => undefined } });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('provider internals'); }));
    const response = await geocode(new Request('https://example.test/api/geocode?q=Arcadia'), context);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain('provider internals');
  });
  it('health verifies storage access', async () => {
    const response = await health(new Request('https://example.test/api/health'), context);
    expect((await response.json()).storage).toBe('connected'); expect(storage.getMetadata).toHaveBeenCalled();
  });
});
