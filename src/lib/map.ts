import L from 'leaflet';
import type { Restroom, RestroomInput } from '../types';

// Constant icon markup only. User content is never inserted as HTML.
const crown = '<svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="m3 7 5 4 4-7 4 7 5-4-3 12H6L3 7Z"/><path d="M7 22h10"/></svg>';
export function pinIcon(selected = false) { return L.divIcon({ className: `royal-pin ${selected ? 'selected' : ''}`, html: `<span>${crown}</span>`, iconSize: [44, 48], iconAnchor: [22, 44] }); }
export const searchIcon = L.divIcon({ className: 'search-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
export const youIcon = L.divIcon({ className: 'you-pin', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
export const tiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';
export const initialCenter: [number, number] = [34.1425, -118.086];
export function possibleDuplicate(input: RestroomInput, restrooms: Restroom[]) {
  const normalize = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const name = normalize(input.locationName);
  return restrooms.find(r => {
    const other = normalize(r.locationName);
    const similar = name === other || (Math.min(name.length, other.length) >= 5 && (name.includes(other) || other.includes(name)));
    const radians = Math.PI / 180;
    const a = Math.sin((r.latitude - input.latitude) * radians / 2) ** 2 + Math.cos(input.latitude * radians) * Math.cos(r.latitude * radians) * Math.sin((r.longitude - input.longitude) * radians / 2) ** 2;
    return similar && 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < 55;
  });
}
