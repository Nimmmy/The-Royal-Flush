import { useEffect, useRef } from 'react';
import { X, Copy, Navigation, Share2, MapPin, KeyRound, MessageSquareText, Pencil } from 'lucide-react';
import type { Restroom } from '../types';
import { StarRating } from './StarRating';
import { copyText } from '../lib/api';

export function RestroomDetailSheet({ restroom, onClose, onEdit, notify }: { onEdit: () => void; restroom: Restroom; onClose: () => void; notify: (text: string) => void }) {
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, [restroom.id]);
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('dialog[open]')) onClose(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  async function copy(text: string, success: string) { try { await copyText(text); notify(success); } catch { notify('Copy isn’t available. Press and hold the text to copy it.'); } }
  async function share() {
    const url = new URL(window.location.origin); url.searchParams.set('restroom', restroom.id);
    const data = { title: `${restroom.locationName} on The Royal Flush`, text: `${restroom.locationName} on The Royal Flush`, url: url.toString() };
    try { if (navigator.share) await navigator.share(data); else await copy(data.url, 'Link copied'); } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) notify('Sharing isn’t available right now.'); }
  }
  return <section className="detail-sheet" aria-labelledby="detail-title">
    <div className="sheet-handle" aria-hidden="true" />
    <div className="detail-topline"><span className="eyebrow">COMMUNITY RESTROOM</span><div className="detail-top-actions"><button className="text-button edit-button" onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit</button><button className="icon-button" aria-label="Close restroom details" onClick={onClose}><X size={21} /></button></div></div>
    <h2 id="detail-title" ref={title} tabIndex={-1}>{restroom.locationName}</h2>
    <StarRating value={restroom.rating} />
    <div className="address-line"><MapPin size={18} aria-hidden="true" /><p>{restroom.address}</p><button className="icon-button" aria-label="Copy address" onClick={() => copy(restroom.address, 'Address copied')}><Copy size={17} /></button></div>
    <div className="codes-grid">{([{ title: 'Men’s code', value: restroom.mensCode }, { title: 'Women’s code', value: restroom.womensCode }]).map(code => <div className="code-card" key={code.title}>
      <span><KeyRound size={14} aria-hidden="true" />{code.title}</span><div className="code-value">{code.value ? <strong>{code.value}</strong> : <span className="not-provided">Not provided</span>}</div>
      {code.value && <button className="copy-button" onClick={() => copy(code.value!, 'Code copied')} aria-label={`Copy ${code.title.toLowerCase()}`}><Copy size={14} />Copy</button>}
    </div>)}</div>
    {restroom.notes && <div className="notes"><h3><MessageSquareText size={16} aria-hidden="true" />Notes</h3><p>{restroom.notes}</p></div>}
    <div className="detail-actions"><a className="primary-button directions-button" href={`https://www.google.com/maps/dir/?api=1&destination=${restroom.latitude},${restroom.longitude}`} target="_blank" rel="noopener noreferrer"><Navigation size={19} />Get Directions</a><button className="secondary-button" aria-label="Share restroom" onClick={share}><Share2 size={19} /></button></div>
    <p className="detail-note">Community information. Access and codes may change.</p>
  </section>;
}
