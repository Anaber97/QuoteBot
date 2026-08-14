// src/components/ClientQuoteForm.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, ShieldAlert, CheckCircle, Truck, MapPin } from 'lucide-react';
import { searchEquipmentSpecs, calculatePermitRequirements } from '../services/equipmentSpecs';
import { loadGoogleMaps } from '../lib/googleMaps';

export default function ClientQuoteForm({ companyRates, onCalculate, isCalculating, title = 'Client Self-Service Quote Portal', onReset }) {
  // Equipment selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatus, setSearchStatus] = useState('');
  const [selectedEquipmentName, setSelectedEquipmentName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  // Specs state
  const [weight, setWeight] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');

  // Location state
  const [pickupAddr, setPickupAddr] = useState('');
  const [dropoffAddr, setDropoffAddr] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const pickupInputRef = useRef(null);
  const dropoffInputRef = useRef(null);

  // Real-time permit evaluation result
  const [permitInfo, setPermitInfo] = useState(null);
  const [attachmentType, setAttachmentType] = useState('');
  const [attachmentWeight, setAttachmentWeight] = useState('');

  const runEquipmentSearch = async (queryOverride = searchQuery) => {
    const trimmedQuery = (queryOverride || '').trim();
    if (!trimmedQuery || trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchStatus('');
      return;
    }

    setIsSearching(true);
    setSearchStatus('Searching...');
    const { results, source, error } = await searchEquipmentSpecs(trimmedQuery);
    setSearchResults(results);
    setSearchStatus(
      error
        ? `Search issue: ${error}`
        : source
          ? `Loaded from ${source}`
          : results.length > 0
            ? ''
            : 'No matches found. Try a different term or add a manual spec.'
    );
    setIsSearching(false);
  };

  // Recalculate permit flags whenever specs or locations change
  useEffect(() => {
    if (weight || width || height || pickupAddr || dropoffAddr) {
      const analysis = calculatePermitRequirements({
        weight,
        width,
        height,
        pickupAddr,
        dropoffAddr,
        companyRates,
      });
      setPermitInfo(analysis);
    } else {
      setPermitInfo(null);
    }
  }, [weight, width, height, pickupAddr, dropoffAddr, companyRates]);

  useEffect(() => {
    let isMounted = true;

    const setupAutocomplete = async () => {
      try {
        const google = await loadGoogleMaps();
        if (!isMounted || typeof window === 'undefined') {
          return;
        }

        if (pickupInputRef.current && !pickupInputRef.current.dataset.autocompleteBound) {
          const pickupAutocomplete = new google.maps.places.Autocomplete(pickupInputRef.current, {
            types: ['address'],
          });
          pickupAutocomplete.addListener('place_changed', () => {
            const place = pickupAutocomplete.getPlace();
            setPickupAddr(place.formatted_address || place.name || pickupInputRef.current?.value || '');
          });
          pickupInputRef.current.dataset.autocompleteBound = 'true';
        }

        if (dropoffInputRef.current && !dropoffInputRef.current.dataset.autocompleteBound) {
          const dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInputRef.current, {
            types: ['address'],
          });
          dropoffAutocomplete.addListener('place_changed', () => {
            const place = dropoffAutocomplete.getPlace();
            setDropoffAddr(place.formatted_address || place.name || dropoffInputRef.current?.value || '');
          });
          dropoffInputRef.current.dataset.autocompleteBound = 'true';
        }
      } catch (error) {
        console.warn('Places autocomplete unavailable:', error);
      }
    };

    setupAutocomplete();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectEquipment = (item) => {
    const fullName = `${item.make} ${item.model}${item.serial_number ? ` (SN: ${item.serial_number})` : ''}`;
    setSelectedEquipmentName(fullName);
    setSearchQuery(fullName);
    setMake(item.make || '');
    setModel(item.model || '');
    setSerialNumber(item.serial_number || '');
    setWeight(item.operating_weight_lbs || '');
    setWidth(item.width_in ?? (item.width_ft != null ? Number(item.width_ft) * 12 : '') || '');
    setHeight(item.height_in ?? (item.height_ft != null ? Number(item.height_ft) * 12 : '') || '');
    setSearchResults([]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pickupAddr) {
      alert('Please enter a pickup location.');
      return;
    }
    const effectiveDropoff = dropoffAddr || pickupAddr;

    onCalculate({
      equipmentName: selectedEquipmentName || searchQuery || 'Custom Load',
      make,
      model,
      serialNumber,
      weight: Number(weight) || 0,
      width: Number(width) || 0,
      height: Number(height) || 0,
      attachmentType,
      attachmentWeight: Number(attachmentWeight) || 0,
      pickupAddr,
      dropoffAddr: effectiveDropoff,
      waypoints: [pickupAddr, ...waypoints.filter(Boolean), effectiveDropoff],
      permitInfo,
    });
  };

  const handleReset = () => {
    setSearchQuery(''); setSearchResults([]); setSelectedEquipmentName(''); setMake(''); setModel(''); setSerialNumber('');
    setWeight(''); setWidth(''); setHeight(''); setPickupAddr(''); setDropoffAddr(''); setWaypoints([]); setAttachmentType(''); setAttachmentWeight(''); setPermitInfo(null);
    onReset?.();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      runEquipmentSearch(searchQuery);
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      const form = e.currentTarget?.closest('form');
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="bg-[#0c1019] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">{title}</h3>
            <p className="text-xs text-slate-400">Search equipment specs and request immediate transport quotes</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Equipment Search Bar */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Equipment Search (Make/Model, or Serial #)
          </label>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedEquipmentName('');
                setMake('');
                setModel('');
                setSerialNumber('');
              }}
              placeholder="e.g. Caterpillar 320, CAT320-001..."
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => runEquipmentSearch(searchQuery)}
              className="absolute right-2 top-2 rounded-lg bg-blue-600/20 border border-blue-500/30 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30"
            >
              Search
            </button>
          </div>

          {/* Autocomplete Dropdown */}
          {isSearching && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0f1523] border border-slate-700 rounded-xl px-4 py-2 text-xs text-slate-400">
              {searchStatus || 'Searching equipment specs...'}
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-[#0f1523] border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectEquipment(item)}
                  className="w-full text-left px-4 py-2.5 hover:bg-blue-600/20 border-b border-slate-800/50 last:border-none transition flex items-center justify-between"
                >
                  <div className="opacity-70">
                    <p className="text-xs font-semibold text-slate-300">
                      {item.make} {item.model}
                    </p>
                    {item.serial_number && (
                      <p className="text-[10px] text-slate-500">SN: {item.serial_number}</p>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-blue-400/70">
                    {item.operating_weight_lbs.toLocaleString()} lbs | {item.width_in ?? (item.width_ft != null ? Number(item.width_ft) * 12 : 0)}w x {item.height_in ?? (item.height_ft != null ? Number(item.height_ft) * 12 : 0)}h in
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Equipment Identity Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Make</label>
            <input
              type="text"
              value={make}
              onChange={(e) => setMake(e.target.value)}
              placeholder="Caterpillar"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="320"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Serial Number</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="SN-00123"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Equipment Dimension Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Operating Weight (lbs)</label>
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="45000"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Width (in)</label>
            <input
              type="number"
              step="1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="102"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Height (in)</label>
            <input
              type="number"
              step="1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="138"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Attachments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Attachment Type</label>
            <input
              type="text"
              value={attachmentType}
              onChange={(e) => setAttachmentType(e.target.value)}
              placeholder="bucket, hammer, grapple..."
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Attachment Weight (lbs)</label>
            <input
              type="number"
              value={attachmentWeight}
              onChange={(e) => setAttachmentWeight(e.target.value)}
              placeholder="8000"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
        </div>

        {/* Locations */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Pickup Address
            </label>
            <input
              ref={pickupInputRef}
              type="text"
              value={pickupAddr}
              onChange={(e) => setPickupAddr(e.target.value)}
              placeholder="Enter pick-up location..."
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
          {waypoints.map((waypoint, index) => (
            <div key={index} className="flex gap-2">
              <input type="text" value={waypoint} onChange={(e) => setWaypoints((current) => current.map((item, itemIndex) => itemIndex === index ? e.target.value : item))} placeholder={`Waypoint ${index + 1}`} className="flex-1 bg-[#080c14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500" />
              <button type="button" onClick={() => setWaypoints((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-xl border border-slate-700 px-3 text-xs text-slate-400 hover:text-red-400">Delete</button>
            </div>
          ))}
          <button type="button" onClick={() => setWaypoints((current) => [...current, ''])} className="rounded-lg border border-blue-500/30 px-3 py-2 text-xs font-semibold text-blue-400 hover:bg-blue-500/10">+ Add waypoint</button>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-400" /> Dropoff Address
            </label>
            <input
              ref={dropoffInputRef}
              type="text"
              value={dropoffAddr}
              onChange={(e) => setDropoffAddr(e.target.value)}
              placeholder="Optional — leave blank for a round-trip quote"
              className="w-full bg-[#080c14] border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500/70 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Real-time Permit & Interstate Flags Banner */}
        {permitInfo && permitInfo.flags.length > 0 && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
              <ShieldAlert className="w-4 h-4" /> Transport Permit Requirements Detected
            </div>
            <ul className="space-y-1">
              {permitInfo.flags.map((flag, idx) => (
                <li key={idx} className="text-[11px] text-amber-200/90 flex items-center gap-1.5 font-medium">
                  • {flag}
                </li>
              ))}
            </ul>
            {permitInfo.permitFee > 0 && (
              <p className="text-xs text-amber-300 font-bold pt-1 border-t border-amber-500/20">
                Estimated Permit Surcharge: +${permitInfo.permitFee.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="grid grid-cols-2 gap-2">
        <button
          type="submit"
          disabled={isCalculating}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm py-3 rounded-xl transition shadow-lg cursor-pointer disabled:opacity-50"
        >
          {isCalculating ? 'Calculating Live Route & Rates...' : 'Calculate Quote'}
        </button>
        <button type="button" onClick={handleReset} className="rounded-xl border border-slate-700 py-3 text-xs font-semibold text-slate-300 hover:bg-slate-800">RESET</button>
        </div>
      </form>
    </div>
  );
}
