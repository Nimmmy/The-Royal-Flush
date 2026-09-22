import { useEffect, useRef, useState } from 'react';
import { X, Crown, LoaderCircle, MapPin, Minus, Plus, ArrowDown, ArrowUp, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import type { FieldErrors, GeoResult, Restroom, RestroomInput } from '../types';
import { AddressSearch } from './AddressSearch';
import { StarSelector } from './StarRating';
import { PinPreview } from './MapView';
import { addRestroom, updateRestroom, ApiError, message } from '../lib/api';
import { validateRestroom } from '../lib/validation';
import { possibleDuplicate } from '../lib/map';

export function AddRestroomSheet({ onClose, onSaved, restrooms, onView, restroom }: { restroom?: Restroom; onClose: () => void; onSaved: (r: Restroom) => void; restrooms: Restroom[]; onView: (r: Restroom) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const [location, setLocation] = useState<GeoResult | null>(restroom ? { displayName: restroom.address, latitude: restroom.latitude, longitude: restroom.longitude } : null);
  const [rating, setRating] = useState(restroom?.rating ?? 0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState<Restroom | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<Restroom | null>(null);
  const [pending, setPending] = useState<RestroomInput | null>(null);
  const [pinTools, setPinTools] = useState(false);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    name.current?.focus({ preventScroll: true });
    return () => { previous?.focus({ preventScroll: true }); };
  }, []);
  async function save(data: RestroomInput) {
    setSaving(true); setSaveError(''); setConflict(null);
    try { onSaved(restroom ? await updateRestroom(restroom, data) : await addRestroom(data)); } catch (e) { setSaveError(message(e, 'We couldn’t save this restroom. Check your connection and try again.')); if (e instanceof ApiError) { if (e.fields) setErrors(e.fields); setConflict(e.currentRestroom ?? null); } requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('.form-alert')?.focus()); }
    finally { setSaving(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const values = new FormData(event.currentTarget);
    const result = validateRestroom({ locationName: values.get('locationName'), address: location?.displayName || '', latitude: location?.latitude, longitude: location?.longitude, mensCode: values.get('mensCode'), womensCode: values.get('womensCode'), rating, notes: values.get('notes') });
    if (!location) result.errors.address = 'Choose an address from the search results.';
    setErrors(result.errors); setSaveError(''); setDuplicate(null);
    if (!result.data || !location) { setSaveError('Please complete the required fields below.'); requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"], input[name="rating"]')?.focus()); return; }
    const existing = possibleDuplicate(result.data, restrooms.filter(item => item.id !== restroom?.id));
    if (existing) { setDuplicate(existing); setPending(result.data); return; }
    await save(result.data);
  }
  function changePin(coords: [number, number]) { setLocation(current => current && { ...current, latitude: Math.max(-90, Math.min(90, coords[0])), longitude: ((coords[1] + 540) % 360) - 180 }); setDuplicate(null); }
  const field = (key: keyof RestroomInput) => ({ 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${key}-error` : undefined });
  const fieldError = (key: keyof RestroomInput) => errors[key] && <span className="field-error" id={`${key}-error`}>{errors[key]}</span>;
  return <dialog ref={dialog} className="add-dialog" aria-labelledby="add-title" onCancel={e => { e.preventDefault(); if (!saving) onClose(); }}>
    <div className="add-heading"><div className="add-crown"><Crown size={23} /></div><div><h2 id="add-title">{restroom ? 'Edit restroom' : 'Add a restroom'}</h2><p>{restroom ? 'Help keep this listing up to date.' : 'A little local knowledge goes a long way.'}</p></div><button type="button" className="icon-button" aria-label={restroom ? 'Close edit restroom' : 'Close add restroom'} disabled={saving} onClick={onClose}><X size={22} /></button></div>
    <form ref={form} noValidate onSubmit={submit} onChange={() => { setDuplicate(null); setPending(null); }}>
      <div className="form-body">
        {saveError && <div className="form-alert" role="alert" tabIndex={-1}>{saveError}{conflict && <button type="button" className="text-button" onClick={() => onView(conflict)}>View latest listing</button>}</div>}
        <div className="form-field"><label htmlFor="location-name">Location name <span className="required">*</span></label><input ref={name} id="location-name" name="locationName" defaultValue={restroom?.locationName} placeholder="Costco – Atwater Village" maxLength={120} autoComplete="off" required {...field('locationName')} />{fieldError('locationName')}</div>
        <AddressSearch label="Address" initialValue={restroom?.address} error={errors.address || errors.latitude || errors.longitude} onQueryChange={() => { setLocation(null); setDuplicate(null); }} onSelect={result => { setLocation(result); setErrors(e => ({ ...e, address: undefined, latitude: undefined, longitude: undefined })); }} />
        {location && <div className="preview-wrap"><PinPreview location={location} onChange={changePin} /><p className="pin-help"><MapPin size={15} />Drag the pin if the location isn’t quite right.</p><button type="button" className="text-button adjust-button" onClick={() => setPinTools(v => !v)} aria-expanded={pinTools}>Adjust pin with buttons {pinTools ? <Minus size={14} /> : <Plus size={14} />}</button>{pinTools && <div className="pin-nudge" aria-label="Move pin approximately five meters">{[{ label: 'Move pin north', icon: ArrowUp, lat: 0.000045, lng: 0 }, { label: 'Move pin south', icon: ArrowDown, lat: -0.000045, lng: 0 }, { label: 'Move pin west', icon: ArrowLeft, lat: 0, lng: -0.000055 }, { label: 'Move pin east', icon: ArrowRight, lat: 0, lng: 0.000055 }].map(item => <button type="button" className="secondary-button" key={item.label} aria-label={item.label} onClick={() => changePin([location.latitude + item.lat, location.longitude + item.lng])}><item.icon size={18} /></button>)}</div>}</div>}
        <div className="form-code-grid"><div className="form-field"><label htmlFor="mens-code">Men’s restroom code <span className="optional">Optional</span></label><input id="mens-code" name="mensCode" defaultValue={restroom?.mensCode ?? ''} placeholder="Leave blank if there isn’t one" maxLength={50} autoComplete="off" {...field('mensCode')} />{fieldError('mensCode')}</div><div className="form-field"><label htmlFor="womens-code">Women’s restroom code <span className="optional">Optional</span></label><input id="womens-code" name="womensCode" defaultValue={restroom?.womensCode ?? ''} placeholder="Leave blank if there isn’t one" maxLength={50} autoComplete="off" {...field('womensCode')} />{fieldError('womensCode')}</div></div>
        <StarSelector value={rating} onChange={value => { setRating(value); setErrors(e => ({ ...e, rating: undefined })); }} error={errors.rating} />
        <div className="form-field"><label htmlFor="notes">Notes <span className="optional">Optional</span></label><textarea id="notes" name="notes" defaultValue={restroom?.notes} rows={3} maxLength={1000} placeholder="Clean bathroom near the food court. Ask the cashier for the key." {...field('notes')} />{fieldError('notes')}</div>
        {duplicate && <div className="duplicate-warning" role="alert"><strong>A restroom at this location may already exist.</strong><p>{duplicate.locationName}<br />{duplicate.address}</p><div><button type="button" className="secondary-button" onClick={() => onView(duplicate)}>View existing</button><button type="button" className="text-button" disabled={saving} onClick={() => pending && save(pending)}>{restroom ? 'Save changes anyway' : 'Add another restroom'}</button></div></div>}
      </div>
      <div className="form-footer"><p>Everything submitted here is public.</p><button type="submit" className="primary-button" disabled={saving || !!conflict}>{saving ? <LoaderCircle size={19} className="spin" /> : restroom ? <Check size={20} /> : <Plus size={20} />}{saving ? 'Saving…' : restroom ? 'Save Changes' : 'Add Restroom'}</button></div>
    </form>
  </dialog>;
}
