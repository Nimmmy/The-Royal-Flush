export type RestroomInput = {
  locationName: string;
  address: string;
  latitude: number;
  longitude: number;
  mensCode: string | null;
  womensCode: string | null;
  rating: number;
  notes: string;
};
export type Restroom = RestroomInput & { id: string; createdAt: string; updatedAt: string };
export type GeoResult = { displayName: string; latitude: number; longitude: number };
export type FieldErrors = Partial<Record<keyof RestroomInput, string>>;
