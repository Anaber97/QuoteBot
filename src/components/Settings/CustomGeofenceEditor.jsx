import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Trash2 } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/googleMaps';

export default function CustomGeofenceEditor({ zone, onChange, onSave, onDelete }) {
  const mapRef = useRef(null);
  const polygonRef = useRef(null);
  const drawingManagerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [status, setStatus] = useState('Draw a polygon to define the municipality area.');

  useEffect(() => {
    if (!zone) return;

    let cancelled = false;

    const bootstrap = async () => {
      try {
        await loadGoogleMaps();
        if (cancelled || !mapRef.current) return;

        const google = window.google;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 39.5, lng: -98.35 },
          zoom: 4,
          mapTypeControl: false,
          streetViewControl: false,
        });

        const drawingManager = new google.maps.drawing.DrawingManager({
          drawingMode: null,
          drawingControl: true,
          drawingControlOptions: {
            position: google.maps.ControlPosition.TOP_CENTER,
            drawingModes: [google.maps.drawing.OverlayType.POLYGON],
          },
          polygonOptions: {
            strokeColor: '#38bdf8',
            strokeWeight: 2,
            fillColor: '#38bdf8',
            fillOpacity: 0.2,
            editable: true,
          },
        });

        drawingManager.setMap(map);
        drawingManagerRef.current = drawingManager;

        const overlayListener = google.maps.event.addListener(drawingManager, 'overlaycomplete', (event) => {
          if (event.type !== google.maps.drawing.OverlayType.POLYGON) return;
          const nextShape = event.overlay.getPath().getArray().map((point) => ({
            lat: point.lat(),
            lng: point.lng(),
          }));

          if (polygonRef.current) {
            polygonRef.current.setMap(null);
          }

          polygonRef.current = event.overlay;
          onChange('shape', nextShape);
          drawingManager.setDrawingMode(null);
          setStatus('Polygon ready. Save this geofence to apply it in quotes.');
        });

        setMapReady(true);

        return () => {
          google.maps.event.removeListener(overlayListener);
          drawingManager.setMap(null);
          drawingManagerRef.current = null;
        };
      } catch (error) {
        console.warn('Google Maps drawing unavailable:', error);
        setStatus('Map drawing is unavailable right now.');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
      if (polygonRef.current) {
        polygonRef.current.setMap(null);
        polygonRef.current = null;
      }
      if (drawingManagerRef.current) {
        drawingManagerRef.current.setMap(null);
        drawingManagerRef.current = null;
      }
    };
  }, [zone?.id]);

  useEffect(() => {
    if (!mapReady || !window.google?.maps || !zone) return;

    if (polygonRef.current) {
      polygonRef.current.setMap(null);
      polygonRef.current = null;
    }

    if (zone.shape?.length >= 3) {
      const google = window.google;
      const path = zone.shape.map((point) => new google.maps.LatLng(point.lat, point.lng));
      const polygon = new google.maps.Polygon({
        paths: path,
        strokeColor: '#38bdf8',
        strokeWeight: 2,
        fillColor: '#38bdf8',
        fillOpacity: 0.2,
        editable: true,
      });

      polygon.setMap(drawingManagerRef.current?.getMap?.() || null);
      polygonRef.current = polygon;

      const bounds = new google.maps.LatLngBounds();
      path.forEach((point) => bounds.extend(point));
      if (!bounds.isEmpty()) {
        drawingManagerRef.current?.getMap?.().fitBounds(bounds);
      }

      google.maps.event.addListener(polygon.getPath(), 'set_at', () => {
        const updatedShape = polygon.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
        onChange('shape', updatedShape);
      });

      google.maps.event.addListener(polygon.getPath(), 'insert_at', () => {
        const updatedShape = polygon.getPath().getArray().map((point) => ({ lat: point.lat(), lng: point.lng() }));
        onChange('shape', updatedShape);
      });
    }
  }, [mapReady, zone?.shape]);

  if (!zone) return null;

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-[#121824] p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Custom geofence</p>
          <p className="font-semibold text-white">{zone.name || 'New municipality zone'}</p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Area label</label>
          <input
            type="text"
            value={zone.name || ''}
            onChange={(e) => onChange('name', e.target.value)}
            placeholder="Example: Downtown Metro"
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">Price surcharge (%)</label>
          <input
            type="number"
            value={zone.price ?? ''}
            onChange={(e) => onChange('price', e.target.value)}
            placeholder="25"
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">City / Municipality</label>
          <input
            type="text"
            value={zone.city || ''}
            onChange={(e) => onChange('city', e.target.value)}
            placeholder="Seattle"
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] text-slate-400">State</label>
          <input
            type="text"
            value={zone.state || ''}
            onChange={(e) => onChange('state', e.target.value)}
            placeholder="WA"
            className="w-full rounded border border-slate-700 bg-[#080c14] p-2 text-white"
          />
        </div>
      </div>

      <div ref={mapRef} className="h-56 overflow-hidden rounded-lg border border-slate-700 bg-[#080c14]" />
      <p className="text-[10px] text-slate-400">{status}</p>

      <button
        type="button"
        onClick={onSave}
        className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-semibold text-white"
      >
        Save custom geofence
      </button>
    </div>
  );
}
