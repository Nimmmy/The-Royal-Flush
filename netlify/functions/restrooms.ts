import type { Config, Context } from '@netlify/functions';
import { randomUUID } from 'node:crypto';
import { restroomStore, json } from './_shared/storage';
import { validateRestroom } from '../../src/lib/validation';
import type { Restroom } from '../../src/types';

export default async (request: Request, context: Context) => {
  const id = context.params?.id;
  const allowed = id ? ['PUT'] : ['GET', 'POST'];
  if (!allowed.includes(request.method)) return json({ error: 'Method not allowed.' }, 405, { Allow: allowed.join(', ') });
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return json({ error: 'This restroom could not be found.' }, 404);
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
    if (id) {
      const expectedUpdatedAt = (input as Record<string, unknown>).expectedUpdatedAt;
      if (typeof expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(expectedUpdatedAt))) return json({ error: 'Reopen this listing before saving your changes.' }, 400);
      const store = restroomStore(context);
      const key = `restrooms/${id}`;
      let entry = await store.getWithMetadata(key, { type: 'json' });
      // Netlify Dev omits ETag on GET. Its list response still includes it.
      // List BEFORE re-reading the value so a newer ETag cannot accompany an
      // older snapshot and accidentally allow an outdated write.
      if (entry && !entry.etag) {
        const listing = await store.list({ prefix: key });
        const listed = listing.blobs.find(blob => blob.key === key);
        const data = await store.get(key, { type: 'json' });
        entry = listed && data ? { data, etag: listed.etag, metadata: {} } : null;
      }
      if (!entry) return json({ error: 'This restroom is no longer available.' }, 404);
      const existing = entry.data as Restroom;
      const conflict = (currentRestroom: Restroom) => json({ error: 'Someone updated this restroom while you were editing. View the latest listing before making your changes again.', currentRestroom }, 409);
      if (existing.updatedAt !== expectedUpdatedAt) return conflict(existing);
      const updatedAt = new Date(Math.max(Date.now(), Date.parse(existing.updatedAt) + 1)).toISOString();
      const restroom: Restroom = { ...existing, ...result.data, id, createdAt: existing.createdAt, updatedAt };
      // The version check explains stale edits; the conditional write also
      // prevents two requests that read the same version from overwriting it.
      if (!entry.etag) throw new Error('Missing storage version');
      const written = await store.setJSON(key, restroom, { onlyIfMatch: entry.etag });
      if (!written.modified) {
        const latest = await store.get(key, { type: 'json' }) as Restroom | null;
        return latest ? conflict(latest) : json({ error: 'This restroom is no longer available.' }, 404);
      }
      if (!written.etag) throw new Error('Storage did not confirm the update');
      return json({ restroom });
    }
    const now = new Date().toISOString();
    const restroom: Restroom = { ...result.data, id: randomUUID(), createdAt: now, updatedAt: now };
    await restroomStore(context).setJSON(`restrooms/${restroom.id}`, restroom);
    return json({ restroom }, 201);
  } catch {
    console.error('Restroom storage request failed', { requestId: context.requestId, method: request.method });
    return json({ error: request.method === 'GET' ? 'We couldn’t load restroom locations. Try again.' : 'We couldn’t save this restroom. Check your connection and try again.' }, 503);
  }
};
export const config: Config = { path: ['/api/restrooms', '/api/restrooms/:id'] };
