import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapContainer, TileLayer, useMap, useMapEvents, Marker, AttributionControl, ZoomControl } from 'react-leaflet';
import type { GeoResult, Restroom } from '../types';
import { initialCenter, pinIcon, searchIcon, youIcon, tiles, attribution } from '../lib/map';

function RestroomMarkers({ restrooms, selected, onSelect }: { restrooms: Restroom[]; selected?: string; onSelect: (r: Restroom) => void }) {
  const map = useMap();
  useEffect(() => {
    const clusters = L.markerClusterGroup({ maxClusterRadius: 45, showCoverageOnHover: false, spiderfyOnMaxZoom: true, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches, iconCreateFunction: cluster => L.divIcon({ html: `<span>${cluster.getChildCount()}</span>`, className: 'royal-cluster', iconSize: [46, 46] }) });
    for (const restroom of restrooms) {
      const marker = L.marker([restroom.latitude, restroom.longitude], { icon: pinIcon(restroom.id === selected), title: `${restroom.locationName} — ${restroom.rating} out of 5 stars`, alt: restroom.locationName, keyboard: true, riseOnHover: true });
      marker.on('click', () => onSelect(restroom)); clusters.addLayer(marker);
    }
    map.addLayer(clusters);
    return () => { clusters.clearLayers(); map.removeLayer(clusters); };
  }, [map, restrooms, selected, onSelect]);
  return null;
}
function MapController({ target, detail, onBounds }: { target: (GeoResult & { token: number; zoom?: number }) | null; detail: boolean; onBounds: (bounds: L.LatLngBounds) => void }) {
  const map = useMapEvents({ moveend: () => onBounds(map.getBounds()), zoomend: () => onBounds(map.getBounds()) });
  useEffect(() => { onBounds(map.getBounds()); }, [map, onBounds]);
  useEffect(() => {
    if (!target) return;
    const zoom = target.zoom || 17;
    let point = map.project([target.latitude, target.longitude], zoom);
    if (detail && window.innerWidth < 700) point = point.add([0, map.getSize().y * 0.19]);
    if (detail && window.innerWidth >= 700) point = point.add([155, 0]);
    map.flyTo(map.unproject(point, zoom), zoom, { duration: 0.6, animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
  }, [map, target, detail]);
  useEffect(() => { const resize = () => map.invalidateSize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize); }, [map]);
  return null;
}
export function MapView({ restrooms, selected, target, searched, you, onSelect, onBounds, onTileError }: {
  restrooms: Restroom[]; selected?: string; target: (GeoResult & { token: number; zoom?: number }) | null;
  searched: GeoResult | null; you: GeoResult | null; onSelect: (r: Restroom) => void; onBounds: (bounds: L.LatLngBounds) => void; onTileError: () => void;
}) {
  return <MapContainer center={initialCenter} zoom={12} zoomControl={false} attributionControl={false} className="main-map" aria-label="Community restroom map">
    <TileLayer url={tiles} attribution={attribution} maxZoom={19} eventHandlers={{ tileerror: onTileError }} />
    <AttributionControl position="bottomleft" />
    <ZoomControl position="topright" />
    <MapController target={target} detail={!!selected} onBounds={onBounds} />
    <RestroomMarkers restrooms={restrooms} selected={selected} onSelect={onSelect} />
    {searched && <Marker position={[searched.latitude, searched.longitude]} icon={searchIcon} title="Searched location" />}
    {you && <Marker position={[you.latitude, you.longitude]} icon={youIcon} title="Your location (not saved)" />}
  </MapContainer>;
}

function PinController({ location }: { location: GeoResult }) {
  const map = useMap();
  const lastAddress = useRef('');
  useEffect(() => { if (lastAddress.current !== location.displayName) { map.setView([location.latitude, location.longitude], 17); lastAddress.current = location.displayName; } }, [location, map]);
  useEffect(() => { const timer = setTimeout(() => map.invalidateSize(), 100); return () => clearTimeout(timer); }, [map]);
  return null;
}
function PinEvents({ onChange }: { onChange: (coords: [number, number]) => void }) { useMapEvents({ click: e => onChange([e.latlng.lat, e.latlng.lng]) }); return null; }
export function PinPreview({ location, onChange }: { location: GeoResult; onChange: (coords: [number, number]) => void }) {
  return <MapContainer className="pin-preview" center={[location.latitude, location.longitude]} zoom={17} scrollWheelZoom={false} attributionControl={false}>
    <TileLayer url={tiles} attribution={attribution} maxZoom={19} />
    <AttributionControl position="bottomleft" />
    <PinController location={location} /><PinEvents onChange={onChange} />
    <Marker position={[location.latitude, location.longitude]} icon={pinIcon()} draggable title="Adjust restroom pin" eventHandlers={{ dragend: event => { const position = event.target.getLatLng(); onChange([position.lat, position.lng]); } }} />
  </MapContainer>;
}
