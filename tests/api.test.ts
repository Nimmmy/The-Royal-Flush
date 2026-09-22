import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '@netlify/functions';
import type { Restroom } from '../src/types';
import { validateRestroom } from '../src/lib/validation';

const { records, storeOptions, storage } = vi.hoisted(() => {
  const records = new Map<string, unknown>();
  const storeOptions: unknown[] = [];
  const storage = {
    setJSON: vi.fn(async (key: string, value: unknown, options?: { onlyIfMatch?: string }) => {
      if (options?.onlyIfMatch && options.onlyIfMatch !== JSON.stringify(records.get(key))) return { modified: false };
      records.set(key, value); return { modified: true, etag: JSON.stringify(value) };
    }),
    getWithMetadata: vi.fn(async (key: string) => records.has(key) ? { data: records.get(key), etag: JSON.stringify(records.get(key)) as string | undefined, metadata: {} } : null),
    get: vi.fn(async (key: string) => records.get(key) || null),
    getMetadata: vi.fn(async () => null),
    list: vi.fn((options: { paginate?: boolean; prefix?: string }) => {
      const page = { blobs: [...records.keys()].filter(k => k.startsWith(options.prefix ?? '')).map(key => ({ key, etag: JSON.stringify(records.get(key)) })) };
      return options.paginate ? (async function* () { yield page; })() : Promise.resolve(page);
    }),
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


describe('anonymous full-listing edits', () => {
  async function create() { return (await (await handler(post(input), context)).json()).restroom as Restroom; }
  const edit = (restroom: Restroom, patch: Record<string, unknown> = {}) => handler(new Request(`https://example.test/api/restrooms/${restroom.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...restroom, expectedUpdatedAt: restroom.updatedAt, ...patch }) }), { ...context, params: { id: restroom.id } });
  it('updates every field in place, normalizes codes, and preserves server identity and creation time', async () => {
    const original = await create();
    const response = await edit(original, { locationName: 'Updated Park', address: '100 West Broadway, Glendale, California', latitude: 34.145, longitude: -118.256, mensCode: ' ', womensCode: '  9876#  ', rating: 2, notes: 'Updated notes.', id: 'spoof', createdAt: 'spoof', updatedAt: 'spoof' });
    expect(response.status).toBe(200);
    const { restroom } = await response.json();
    expect(restroom).toEqual({ ...original, locationName: 'Updated Park', address: '100 West Broadway, Glendale, California', latitude: 34.145, longitude: -118.256, mensCode: null, womensCode: '9876#', rating: 2, notes: 'Updated notes.', updatedAt: expect.any(String) });
    expect(restroom.updatedAt > original.updatedAt).toBe(true); expect(records.size).toBe(1);
    const independent = await handler(new Request('https://example.test/api/restrooms'), context);
    expect((await independent.json()).restrooms).toEqual([restroom]);
  });
  it('rejects stale forms and preserves the other contributor’s changes', async () => {
    const original = await create();
    const first = await edit(original, { womensCode: '1357' }); expect(first.status).toBe(200);
    const stale = await edit(original, { mensCode: '2468' }); expect(stale.status).toBe(409);
    expect((await stale.json()).currentRestroom.womensCode).toBe('1357');
    expect((records.get(`restrooms/${original.id}`) as Restroom).mensCode).toBe('#2468');
  });
  it('atomically allows only one of two edits that read the same version', async () => {
    const original = await create();
    const responses = await Promise.all([edit(original, { mensCode: '1111' }), edit(original, { womensCode: '2222' })]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const saved = (await responses.find(r => r.status === 200)!.json()).restroom;
    expect(records.get(`restrooms/${original.id}`)).toEqual(saved);
  });
  it('validates updates and does not create missing IDs or accept client Blob keys', async () => {
    const original = await create();
    expect((await edit(original, { rating: 8 })).status).toBe(400);
    expect((await edit(original, { expectedUpdatedAt: null })).status).toBe(400);
    expect((await edit({ ...original, id: '00000000-0000-0000-0000-000000000000' })).status).toBe(404);
    expect((await edit({ ...original, id: '../another-store' })).status).toBe(404);
    expect((await handler(new Request('https://example.test/api/restrooms', { method: 'PUT' }), context)).status).toBe(405);
    expect(records.get(`restrooms/${original.id}`)).toEqual(original);
  });
  it('supports the local emulator’s missing GET ETag using list then a fresh read', async () => {
    const original = await create();
    storage.getWithMetadata.mockResolvedValueOnce({ data: original, etag: undefined, metadata: {} });
    const response = await edit(original, { womensCode: '5678' });
    expect(response.status).toBe(200); expect((await response.json()).restroom.womensCode).toBe('5678');
  });
  it('does not claim success when storage fails to confirm an edit', async () => {
    const original = await create();
    storage.setJSON.mockResolvedValueOnce({ modified: true, etag: '' });
    expect((await edit(original, { notes: 'New notes' })).status).toBe(503);
  });
});
