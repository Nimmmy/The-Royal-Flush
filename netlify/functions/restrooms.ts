import type { Config, Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { restroomStore, json } from './_shared/storage';
import { validateRestroom } from '../../src/lib/validation';
import type { Restroom } from '../../src/types';

export default async (request: Request, context: Context) => {
  if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  try {
    if (request.method === 'GET') {
      const store = restroomStore(context);
      const restrooms: Restroom[] = [];
      for await (const page of store.list({ prefix: 'restrooms/', paginate: true })) {
        // Bounded batches avoid opening thousands of simultaneous storage requests.
        for (let start = 0; start < page.blobs.length; start += 20) {
          const entries = await Promise.all(page.blobs.slice(start, start + 20).map(blob => store.get(blob.key, { type: 'json' }) as Promise<Restroom | null>));
          restrooms.push(...entries.filter((item): item is Restroom => item !== null));
        }
      }
      restrooms.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return json({ restrooms });
    }
    if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) return json({ error: 'Send a JSON submission.' }, 415);
    if (Number(request.headers.get('content-length') || 0) > 16000) return json({ error: 'This submission is too large.' }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16000) return json({ error: 'This submission is too large.' }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return json({ error: 'This submission is not valid JSON.' }, 400); }
    const result = validateRestroom(input);
    if (!result.data) return json({ error: 'Please check the highlighted fields.', errors: result.errors }, 400);
    const now = new Date().toISOString();
    const restroom: Restroom = { ...result.data, id: randomUUID(), createdAt: now, updatedAt: now };
    await restroomStore(context).setJSON(`restrooms/${restroom.id}`, restroom);
    return json({ restroom }, 201);
  } catch {
    console.error('Restroom storage request failed', { requestId: context.requestId, method: request.method });
    return json({ error: request.method === 'GET' ? 'We couldn’t load restroom locations. Try again.' : 'We couldn’t save this restroom. Check your connection and try again.' }, 503);
  }
};
export const config: Config = { path: '/api/restrooms' };
