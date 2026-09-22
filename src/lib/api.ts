import type { GeoResult, Restroom, RestroomInput, FieldErrors } from '../types';
import { validateRestroom } from './validation';

export class ApiError extends Error {
  fields?: FieldErrors;
  constructor(message: string, fields?: FieldErrors) { super(message); this.fields = fields; }
}
async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, signal: init?.signal || AbortSignal.timeout(20000) });
  let body;
  try { body = await response.json(); } catch { throw new ApiError('The server returned an unexpected response. Please try again.'); }
  if (!response.ok) throw new ApiError(body.error || (response.status === 429 ? 'Too many searches. Please wait a moment and try again.' : 'Something went wrong. Please try again.'), body.errors);
  return body;
}
function isRestroom(value: unknown): value is Restroom {
  const item = value as Restroom | null;
  return !!item && !!validateRestroom(item).data && typeof item.id === 'string' && typeof item.createdAt === 'string' && typeof item.updatedAt === 'string';
}
export async function fetchRestrooms() {
  const body = await request('/api/restrooms', { cache: 'no-store' });
  if (!Array.isArray(body.restrooms) || !body.restrooms.every(isRestroom)) throw new ApiError('We couldn’t read the restroom locations. Please try again.');
  return body.restrooms as Restroom[];
}
export async function addRestroom(data: RestroomInput) {
  const body = await request('/api/restrooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  if (!isRestroom(body.restroom)) throw new ApiError('The saved restroom response was unexpected. Refresh the map before trying again.');
  return body.restroom;
}
export async function geocode(query: string, signal: AbortSignal) {
  const body = await request(`/api/geocode?q=${encodeURIComponent(query)}`, { signal });
  if (!Array.isArray(body.results) || !body.results.every((r: GeoResult) => typeof r.displayName === 'string' && Number.isFinite(r.latitude) && Number.isFinite(r.longitude))) throw new ApiError('Address search returned an unexpected response. Try again.');
  return body.results as GeoResult[];
}
export function message(error: unknown, fallback: string) { return error instanceof ApiError ? error.message : fallback; }

export async function copyText(value: string) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return; }
  const input = document.createElement('textarea');
  input.value = value; input.style.position = 'fixed'; input.style.opacity = '0';
  document.body.append(input); input.select();
  const ok = document.execCommand('copy'); input.remove();
  if (!ok) throw new Error('Clipboard unavailable');
}
