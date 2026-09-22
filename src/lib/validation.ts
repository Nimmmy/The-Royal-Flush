import type { FieldErrors, RestroomInput } from '../types';

export function validateRestroom(input: unknown): { data?: RestroomInput; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  function text(key: keyof RestroomInput, label: string, min: number, max: number, optional = false): string {
    const value = body[key];
    if (optional && (value === undefined || value === null)) return '';
    if (typeof value !== 'string') { errors[key] = `${label} must be plain text.`; return ''; }
    const clean = value.trim();
    if (clean.length < min || clean.length > max) errors[key] = `${label} must be ${min ? `${min}–` : 'no more than '}${max} characters.`;
    if (/<\/?[a-z][^>]*>/i.test(clean) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean)) errors[key] = `${label} must be plain text, without HTML.`;
    return clean;
  }
  const data: RestroomInput = {
    locationName: text('locationName', 'Location name', 2, 120),
    address: text('address', 'Address', 5, 250),
    latitude: body.latitude as number, longitude: body.longitude as number,
    mensCode: text('mensCode', 'Men’s code', 0, 50, true) || null,
    womensCode: text('womensCode', 'Women’s code', 0, 50, true) || null,
    rating: body.rating as number,
    notes: text('notes', 'Notes', 0, 1000, true),
  };
  if (typeof data.latitude !== 'number' || !Number.isFinite(data.latitude) || Math.abs(data.latitude) > 90) errors.latitude = 'Choose an address from the search results.';
  if (typeof data.longitude !== 'number' || !Number.isFinite(data.longitude) || Math.abs(data.longitude) > 180) errors.longitude = 'Choose an address from the search results.';
  if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) errors.rating = 'Choose a rating from 1 to 5 stars.';
  return Object.keys(errors).length ? { errors } : { errors, data };
}
