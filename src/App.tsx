import { useCallback, useEffect, useRef, useState } from 'react';
import type L from 'leaflet';
import { Crown, Plus, LocateFixed, RefreshCw, LoaderCircle, MapPin, X, Info } from 'lucide-react';
import { MapView } from './components/MapView';
import { AddressSearch } from './components/AddressSearch';
import { AddRestroomSheet } from './components/AddRestroomSheet';
import { RestroomDetailSheet } from './components/RestroomDetailSheet';
import { fetchRestrooms, message } from './lib/api';
import type { GeoResult, Restroom } from './types';

export default function App() {
  const [restrooms, setRestrooms] = useState<Restroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tileError, setTileError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Restroom | null>(null);
  const [target, setTarget] = useState<(GeoResult & { token: number; zoom?: number }) | null>(null);
  const [searched, setSearched] = useState<GeoResult | null>(null);
  const [you, setYou] = useState<GeoResult | null>(null);
  const [bounds, setBounds] = useState<L.LatLngBounds | null>(null);
  const [locating, setLocating] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState(false);
  const firstLoad = useRef(true);
  const addButton = useRef<HTMLButtonElement>(null);
  const onTileError = useCallback(() => setTileError(true), []);
  const notify = useCallback((text: string) => { setToast(text); }, []);
  useEffect(() => { if (toast) { const timeout = setTimeout(() => setToast(''), 5000); return () => clearTimeout(timeout); } }, [toast]);
  const choose = useCallback((restroom: Restroom) => {
    setSelected(restroom); setSearched(null); setTarget({ displayName: restroom.address, latitude: restroom.latitude, longitude: restroom.longitude, token: Date.now() });
    const url = new URL(window.location.href); url.searchParams.set('restroom', restroom.id); history.replaceState(null, '', url);
  }, []);
  const closeDetails = useCallback(() => {
    setSelected(null); const url = new URL(window.location.href); url.searchParams.delete('restroom'); history.replaceState(null, '', url); addButton.current?.focus({ preventScroll: true });
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try {
      const loaded = await fetchRestrooms(); setRestrooms(loaded);
      setSelected(current => current ? loaded.find(r => r.id === current.id) || null : null);
      if (firstLoad.current) {
        firstLoad.current = false;
        const id = new URLSearchParams(location.search).get('restroom');
        const linked = loaded.find(r => r.id === id);
        if (linked) choose(linked); else if (id) notify('This restroom is no longer available.');
      }
    } catch (e) { setLoadError(message(e, 'We couldn’t load restroom locations. Try again.')); }
    finally { setLoading(false); }
  }, [choose, notify]);
  useEffect(() => { void load(); }, [load]);
  function locate() {
    if (!navigator.geolocation) { notify('Your browser doesn’t support location. Search for an address instead.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(position => {
      const result = { displayName: 'Your location', latitude: position.coords.latitude, longitude: position.coords.longitude };
      setYou(result); closeDetails(); setSearched(null); setTarget({ ...result, token: Date.now(), zoom: 16 }); setLocating(false);
    }, error => { setLocating(false); notify(error.code === 1 ? 'Location access was denied. You can still search for an address.' : 'We couldn’t find your location. Try searching for an address.'); }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  }
  const visible = bounds ? restrooms.filter(r => bounds.contains([r.latitude, r.longitude])).length : restrooms.length;
  return <div className="app-shell">
    <header className="app-header"><a className="brand" href="/" aria-label="The Royal Flush home"><span className="brand-mark"><Crown size={28} strokeWidth={1.7} /></span><span><h1>The Royal Flush</h1><p>Know before you go.</p></span></a><div className="header-right"><span className="community-label">Good to know. Better to share.</span><button className="icon-button info-button" aria-label="About The Royal Flush" aria-expanded={info} onClick={() => setInfo(v => !v)}><Info size={21} /></button></div></header>
    <main className={`map-workspace ${selected ? 'with-detail' : ''}`}>
      <MapView restrooms={restrooms} selected={selected?.id} target={target} searched={searched} you={you} onSelect={choose} onBounds={setBounds} onTileError={onTileError} />
      <div className="search-panel"><AddressSearch restrooms={restrooms} onRestroom={choose} onSelect={result => { closeDetails(); setSearched(result); setTarget({ ...result, token: Date.now(), zoom: /\d/.test(result.displayName) ? 17 : 13 }); }} />
        <div className="map-status" aria-live="polite">{loading ? <><LoaderCircle size={14} className="spin" />Loading restrooms…</> : loadError ? <><span>Locations unavailable</span><button className="text-button" onClick={load}>Retry</button></> : <><span className="status-symbol"><Crown size={13} /></span><strong>{visible}</strong> {visible === 1 ? 'restroom' : 'restrooms'} in this area</>}</div>
      </div>
      <div className="map-tools"><button className="icon-button map-tool" aria-label="My location" title="My location" disabled={locating} onClick={locate}>{locating ? <LoaderCircle size={21} className="spin" /> : <LocateFixed size={21} />}</button><button className="icon-button map-tool" aria-label="Refresh restrooms" title="Refresh restrooms" disabled={loading} onClick={load}><RefreshCw size={19} className={loading ? 'spin' : ''} /></button></div>
      {loadError && <div className="map-alert" role="alert"><span>{loadError}</span><button className="text-button" onClick={load}>Retry</button></div>}
      {tileError && <div className="tile-alert" role="status">Some map tiles couldn’t load. Check your connection.<button className="icon-button" aria-label="Dismiss map notice" onClick={() => setTileError(false)}><X size={16} /></button></div>}
      {!selected && !loading && !loadError && visible === 0 && <div className="empty-state"><MapPin size={19} /><div><strong>No restrooms added here yet.</strong><span>Know a good one? Add it to The Royal Flush.</span></div></div>}
      <button ref={addButton} className="primary-button add-restroom" onClick={() => setAddOpen(true)}><Plus size={21} />Add Restroom</button>
      {selected && <RestroomDetailSheet restroom={selected} onClose={closeDetails} notify={notify} />}
      {info && <section className="info-card" aria-label="About The Royal Flush"><button className="icon-button" aria-label="Close about" onClick={() => setInfo(false)}><X size={18} /></button><Crown size={25} /><h2>A little help, wherever you go.</h2><p>Find a restroom. Share a code. Leave a rating. Anyone can contribute, and everything submitted is public.</p><p>Your location is used only when you tap My Location. It isn’t saved.</p><p>Maps and address search are provided by OpenStreetMap and Photon.</p></section>}
    </main>
    <footer className="app-footer"><span>The Royal Flush is community-powered. Restroom information and access codes may change.</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">Report a map issue</a></footer>
    {addOpen && <AddRestroomSheet restrooms={restrooms} onClose={() => setAddOpen(false)} onView={restroom => { setAddOpen(false); choose(restroom); }} onSaved={restroom => { setRestrooms(items => [restroom, ...items.filter(r => r.id !== restroom.id)]); setAddOpen(false); choose(restroom); notify('Restroom added!'); }} />}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status" aria-live="polite">{toast}</div>
  </div>;
}
