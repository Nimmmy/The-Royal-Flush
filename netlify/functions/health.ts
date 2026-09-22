import type { Config, Context } from '@netlify/functions';
import { json, restroomStore, storeName } from './_shared/storage';

export default async (request: Request, context: Context) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET' });
  try {
    await restroomStore(context).getMetadata('health-check');
    return json({ status: 'ok', service: 'The Royal Flush', storage: 'connected', store: storeName(context) });
  } catch { return json({ status: 'unavailable', error: 'Storage is temporarily unavailable.' }, 503); }
};
export const config: Config = { path: '/api/health' };
