import { useEffect, useId, useRef, useState } from 'react';
import { Search, MapPin, LoaderCircle, X, Crown } from 'lucide-react';
import { geocode, message } from '../lib/api';
import type { GeoResult, Restroom } from '../types';

type Props = {
  onSelect: (result: GeoResult) => void;
  label?: string;
  error?: string;
  restrooms?: Restroom[];
  onRestroom?: (r: Restroom) => void;
  onQueryChange?: () => void;
};
export function AddressSearch({ onSelect, label = 'Search an address, city, or place', error, restrooms = [], onRestroom, onQueryChange }: Props) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(-1);
  const [retry, setRetry] = useState(0);
  const cache = useRef(new Map<string, GeoResult[]>());
  const selectedText = useRef('');
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const local = query.trim().length >= 2 ? restrooms.filter(r => r.locationName.toLowerCase().includes(query.toLowerCase().trim())).slice(0, 3) : [];
  const options = [...local.map(r => ({ name: r.locationName, sub: r.address, restroom: r, geo: null as GeoResult | null })), ...results.map(r => ({ name: r.displayName, sub: '', restroom: null as Restroom | null, geo: r }))];

  useEffect(() => {
    const controller = new AbortController();
    setSearchError(''); setSearched(false); setActive(-1); setResults([]);
    const q = query.trim();
    if (q.length < 3 || q === selectedText.current) { setBusy(false); return; }
    setBusy(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = cache.current.get(q.toLowerCase()) ?? await geocode(q, controller.signal);
        cache.current.set(q.toLowerCase(), found);
        if (!controller.signal.aborted) { setResults(found); setSearched(true); }
      } catch (e) {
        if (!controller.signal.aborted) setSearchError(message(e, 'We couldn’t search right now. Check your connection and try again.'));
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }, 800);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, retry]);
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, []);
  function choose(index: number) {
    const option = options[index]; if (!option) return;
    selectedText.current = option.geo?.displayName || option.name;
    setQuery(selectedText.current); setOpen(false); setActive(-1);
    if (option.restroom) onRestroom?.(option.restroom); else if (option.geo) onSelect(option.geo);
    input.current?.focus();
    setOpen(false);
  }
  return <div className={`address-search ${error ? 'has-error' : ''}`} ref={root} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setOpen(false); }}>
    <label className={label === 'Address' ? 'form-label' : 'sr-only'} htmlFor={id}>{label}{label === 'Address' && <span className="required"> *</span>}</label>
    <div className="search-input-wrap"><Search size={20} aria-hidden="true" />
      <input id={id} ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open && query.trim().length >= 3} aria-controls={`${id}-results`} aria-activedescendant={active >= 0 ? `${id}-option-${active}` : undefined} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} maxLength={250} autoComplete="off" placeholder={label === 'Address' ? 'Search for a street address or place' : 'Search an address, city, or place'} value={query} onChange={e => { selectedText.current = ''; setQuery(e.target.value); setOpen(true); onQueryChange?.(); }} onFocus={() => { if (query !== selectedText.current) setOpen(true); }} onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, options.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter') { e.preventDefault(); if (open && active >= 0) choose(active); else { setOpen(true); setRetry(r => r + 1); } }
        else if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
      }} />
      {busy ? <LoaderCircle className="spin search-spinner" size={19} aria-label="Searching" /> : query && <button type="button" className="icon-button clear-search" aria-label="Clear search" onClick={() => { selectedText.current = ''; setQuery(''); setOpen(false); onQueryChange?.(); input.current?.focus(); }}><X size={18} /></button>}
    </div>
    {error && <span className="field-error" id={`${id}-error`}>{error}</span>}
    {open && query.trim().length >= 3 && <div className="search-dropdown">
      <div id={`${id}-results`} role="listbox" aria-label="Search results">{options.map((option, index) => <button type="button" role="option" aria-selected={active === index} id={`${id}-option-${index}`} key={`${option.name}-${index}`} className={active === index ? 'result active' : 'result'} onClick={() => choose(index)} onMouseEnter={() => setActive(index)}>
        {option.restroom ? <Crown size={18} /> : <MapPin size={18} />}<span>{option.name}{option.sub && <small>{option.sub}</small>}</span>
      </button>)}</div>
      {busy && <p className="search-message" role="status">Searching places…</p>}
      {searchError && <div className="search-message" role="alert">{searchError}<button type="button" className="text-button" onClick={() => setRetry(r => r + 1)}>Try again</button></div>}
      {!busy && !searchError && searched && !options.length && <p className="search-message" role="status">No matches. Try a street address and city.</p>}
      {!!results.length && <div className="search-credit">Search by Photon · OpenStreetMap</div>}
    </div>}
  </div>;
}
