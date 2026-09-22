import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';

export function storeName(context: Pick<Context, 'deploy'>, kind = 'restrooms') {
  // Published production and production-context deploys use the same persistent site store.
  // Drafts and branch previews are isolated even when built with production build variables.
  const production = context.deploy.context === 'production' && context.deploy.published;
  return `royal-flush-${kind}${production ? '' : '-development'}`;
}
export function restroomStore(context: Context) {
  return getStore({ name: storeName(context), consistency: 'strong' });
}
export function json(value: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
