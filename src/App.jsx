import React, { useState, useEffect, useRef } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { GEOFENCES } from './config/geofences';
import { supabase } from './lib/supabase';
import QuoteLog from './components/QuoteLog';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function App() {
  const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'log'

  // Base Location Selection
  const [selectedBaseId, setSelectedBaseId] = useState(SHOP_LOCATIONS[0].id);
  const currentBase = SHOP_LOCATIONS.find((b) => b.id === selectedBaseId) || SHOP_LOCATIONS[0];

  // Dynamic Waypoints Array
  const [waypoints, setWaypoints] = useState(['', '']);

  // Surcharge Checkbox Options
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [isRoadClub, setIsRoadClub] = useState(false);
  const [isMetro, setIsMetro] = useState(false);

  // Manual Override States for Badges
  const [activeOverrides, setActiveOverrides] = useState({
    afterHours: true,
    roadClub: true,
    metro: true,
  });

  // UI Toggle States
  const [showDetails, setShowDetails] = useState(false);

  // Logging Customer Fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Results & UI States
  const [mapUrl, setMapUrl] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quoteData, setQuoteData] = useState(null);

  const inputRefs = useRef([]);

  // Load Google Maps SDK
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places && window.google.maps.geometry) {
      setIsApiLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.onload = () => setIsApiLoaded(true);
    script.onerror = () => setError('Failed to load Google Maps SDK.');
    document.head.appendChild(script);
  }, []);

  // Attach Places Autocomplete safely (handles tab switching & dynamic stops)
  useEffect(() => {
    if (!isApiLoaded || activeTab !== 'calculator') return;

    const options = {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
    };

    const timer = setTimeout(() => {
      waypoints.forEach((_, index) => {
        const ref = inputRefs.current[index];
        if (ref) {
          if (!document.body.contains(ref.dataset.autocompleteAttachedElement)) {
            ref.dataset.autocompleteAttached = '';
          }

          if (!ref.dataset.autocompleteAttached) {
            const autocomplete = new window.google.maps.places.Autocomplete(ref, options);
            autocomplete.addListener('place_changed', () => {
              const place = autocomplete.getPlace();
              if (place && place.formatted_address) {
                handleWaypointChange(index, place.formatted_address);
              } else if (ref.value) {
                handleWaypointChange(index, ref.value);
              }
            });
            ref.dataset.autocompleteAttached = 'true';
          }
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [isApiLoaded, activeTab, waypoints.length]);

  const roundToNearest25 = (value) => Math.round(value / 25) * 25;

  const handleWaypointChange = (index, value) => {
    setWaypoints((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const addWaypoint = () => {
    setWaypoints((prev) => {
      const updated = [...prev];
      updated.splice(updated.length - 1, 0, '');
      return updated;
    });
  };

  const removeWaypoint = (index) => {
    setWaypoints((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleReset = () => {
    setWaypoints(['', '']);
    setIsAfterHours(false);
    setIsRoadClub(false);
    setIsMetro(false);
    setActiveOverrides({ afterHours: true, roadClub: true, metro: true });
    setShowDetails(false);
    setCustomerName('');
    setCustomerPhone('');
    setSaveStatus(null);
    setMapUrl('');
    setCustomRate('');
    setQuoteData(null);
    setError(null);
  };

  const toggleOverride = (key) => {
    setActiveOverrides((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const checkGeofenceZone = async (zoneConfig, addresses) => {
    const isPointInBox = (lat, lng) => {
      const { box } = zoneConfig;
      return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
    };

    const hasKeyword = addresses.some((addr) =>
      zoneConfig.cities.some((city) => addr.toLowerCase().includes(city))
    );
    if (hasKeyword) return true;

    const geocoder = new window.google.maps.Geocoder();
    const geocodeAddress = (addr) =>
      new Promise((res) => {
        if (!addr.trim()) return res(null);
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            res({ lat: loc.lat(), lng: loc.lng() });
          } else {
            res(null);
          }
        });
      });

    const coordsList = await Promise.all(addresses.map((a) => geocodeAddress(a)));
    const directHit = coordsList.some((c) => c && isPointInBox(c.lat, c.lng));
    if (directHit) return true;

    return new Promise((resolve) => {
      const directionsService = new window.google.maps.DirectionsService();
      const origin = addresses[0];
      const destination = addresses[addresses.length - 1];
      const intermediateWaypoints = addresses.slice(1, -1).map((addr) => ({
        location: addr,
        stopover: true,
      }));

      directionsService.route(
        {
          origin,
          destination,
          waypoints: intermediateWaypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result.routes[0]) {
            const route = result.routes[0];
            const passesThrough = route.legs.some((leg) => {
              const startIn = isPointInBox(leg.start_location.lat(), leg.start_location.lng());
              const endIn = isPointInBox(leg.end_location.lat(), leg.end_location.lng());
              if (startIn || endIn) return true;

              return (leg.steps || []).some((step) =>
                (step.path || []).some((pt) => isPointInBox(pt.lat(), pt.lng()))
              );
            });
            resolve(passesThrough);
          } else {
            resolve(false);
          }
        }
      );
    });
  };

  const handleCalculate = async (e) => {
    if (e) e.preventDefault();

    const cleanWaypoints = waypoints.map((w) => w.trim()).filter(Boolean);
    if (cleanWaypoints.length < 2) {
      setError('Please enter at least a Pick-up and Drop-off location.');
      return;
    }

    setLoading(true);
    setError(null);
    setSaveStatus(null);
    setActiveOverrides({ afterHours: true, roadClub: true, metro: true });

    const puAddress = cleanWaypoints[0];
    const doAddress = cleanWaypoints[cleanWaypoints.length - 1];

    const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(
      puAddress
    )}&destination=${encodeURIComponent(doAddress)}&mode=driving`;
    setMapUrl(embedUrl);

    try {
      const [hitDFW, hitHouston] = await Promise.all([
        checkGeofenceZone(GEOFENCES.dfw, cleanWaypoints),
        checkGeofenceZone(GEOFENCES.houston, cleanWaypoints),
      ]);

      const routePoints = [currentBase.address, ...cleanWaypoints, currentBase.address];
      const distanceService = new window.google.maps.DistanceMatrixService();

      let totalDriveSeconds = 0;
      const legsDetails = [];

      for (let i = 0; i < routePoints.length - 1; i++) {
        const from = routePoints[i];
        const to = routePoints[i + 1];

        const response = await new Promise((res, rej) => {
          distanceService.getDistanceMatrix(
            {
              origins: [from],
              destinations: [to],
              travelMode: window.google.maps.TravelMode.DRIVING,
            },
            (resData, status) => {
              if (status === 'OK') res(resData);
              else rej(status);
            }
          );
        });

        const legSec = response.rows[0].elements[0].duration.value;
        totalDriveSeconds += legSec;

        let label = `Leg ${i + 1}`;
        if (i === 0) label = 'Base → Pick-up';
        else if (i === routePoints.length - 2) label = 'Drop-off → Base';
        else if (i === 1) label = 'Pick-up → Stop 1';
        else label = `Stop ${i - 1} → Stop ${i}`;

        legsDetails.push({ label, minutes: Math.round(legSec / 60) });
      }

      const totalDriveMinutes = totalDriveSeconds / 60;
      const adjustedDriveMinutes = totalDriveMinutes * 1.10;
      const loadUnloadTime = 30 + (cleanWaypoints.length - 2) * 15;
      const totalJobMinutes = adjustedDriveMinutes + loadUnloadTime;
      const totalHours = totalJobMinutes / 60;

      const hasAnyMetroZone = hitDFW || hitHouston || isMetro;

      setQuoteData({
        cleanWaypoints,
        legsDetails,
        adjustedDriveMin: Math.round(adjustedDriveMinutes),
        loadUnloadTime,
        rawTotalHours: totalHours,
        totalHours: totalHours.toFixed(2),
        baseMinQuote: roundToNearest25(totalHours * 125),
        baseMaxQuote: roundToNearest25(totalHours * 135),
        hasAfterHours: isAfterHours,
        hasRoadClub: isRoadClub,
        hasMetroZone: hasAnyMetroZone,
      });

      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError('An error occurred calculating driving legs or geofences.');
    }
  };

  // Recalculate quote
  let effectiveMultiplier = 1.0;
  if (quoteData) {
    if (quoteData.hasAfterHours && activeOverrides.afterHours) effectiveMultiplier *= 1.25;
    if (quoteData.hasRoadClub && activeOverrides.roadClub) effectiveMultiplier *= 1.15;
    if (quoteData.hasMetroZone && activeOverrides.metro) effectiveMultiplier *= 1.2857;
  }

  const currentMinQuote = quoteData ? roundToNearest25(quoteData.rawTotalHours * 125 * effectiveMultiplier) : 0;
  const currentMaxQuote = quoteData ? roundToNearest25(quoteData.rawTotalHours * 135 * effectiveMultiplier) : 0;

  const customCalculatedQuote =
    quoteData && customRate && !isNaN(parseFloat(customRate))
      ? roundToNearest25(quoteData.rawTotalHours * parseFloat(customRate) * effectiveMultiplier)
      : null;

  // Supabase Save Handler
  const handleLogQuote = async () => {
    if (!quoteData) return;

    setIsSaving(true);
    setSaveStatus(null);

    const activeModifiers = [];
    if (quoteData.hasAfterHours && activeOverrides.afterHours) activeModifiers.push('+25% After Hours');
    if (quoteData.hasRoadClub && activeOverrides.roadClub) activeModifiers.push('+15% Road Club');
    if (quoteData.hasMetroZone && activeOverrides.metro) activeModifiers.push('+28.57% Metro');

    const { error } = await supabase.from('quotes').insert([
      {
        base_location: currentBase.name,
        customer_name: customerName.trim() || 'N/A',
        customer_phone: customerPhone.trim() || 'N/A',
        waypoints: quoteData.cleanWaypoints,
        estimated_hours: parseFloat(quoteData.totalHours),
        quote_min: currentMinQuote,
        quote_max: currentMaxQuote,
        custom_rate: customRate ? parseFloat(customRate) : null,
        surcharges_applied: activeModifiers,
      },
    ]);

    setIsSaving(false);
    if (error) {
      setSaveStatus({ type: 'error', message: `Failed to save: ${error.message}` });
    } else {
      setSaveStatus({ type: 'success', message: 'Quote logged successfully!' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-xl w-full bg-[#161b26] rounded-2xl shadow-2xl p-8 border border-slate-800">
        
        {/* Navigation Tabs */}
        <div className="flex bg-[#0b0f17] border border-slate-800 rounded-xl p-1 mb-8">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'calculator'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition cursor-pointer ${
              activeTab === 'log'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Quote Log
          </button>
        </div>

        {activeTab === 'log' ? (
          <QuoteLog />
        ) : (
          <>
            {/* Header & Base Shop Selector */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-3">
                Towing Quote Calculator
              </h1>
              <div className="flex items-center gap-2">
                <label className="text-xs uppercase font-semibold text-slate-400">Base Location:</label>
                <select
                  value={selectedBaseId}
                  onChange={(e) => setSelectedBaseId(e.target.value)}
                  className="bg-[#1f2636] border border-slate-700 text-white text-xs font-semibold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {SHOP_LOCATIONS.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name} ({shop.address})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            {/* Inputs Form */}
            <form onSubmit={handleCalculate} className="space-y-6">
              
              {/* Checkboxes */}
              <div className="grid grid-cols-1 gap-2.5">
                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="afterHours"
                    checked={isAfterHours}
                    onChange={(e) => setIsAfterHours(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="afterHours" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    After Hours / Weekend Callout <span className="text-blue-400 font-bold">(+25%)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="roadClub"
                    checked={isRoadClub}
                    onChange={(e) => setIsRoadClub(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="roadClub" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Road Club Account <span className="text-blue-400 font-bold">(+15%)</span>
                  </label>
                </div>

                <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="metro"
                    checked={isMetro}
                    onChange={(e) => setIsMetro(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                  />
                  <label htmlFor="metro" className="text-xs font-medium text-slate-200 cursor-pointer flex-1">
                    Manual Metro Surcharge <span className="text-blue-400 font-bold">(+28.57%)</span>
                  </label>
                </div>
              </div>

              {/* Waypoints */}
              <div className="space-y-4">
                {waypoints.map((address, index) => {
                  const isPickUp = index === 0;
                  const isDropOff = index === waypoints.length - 1;
                  const isWaypoint = !isPickUp && !isDropOff;
                  const label = isPickUp ? 'Pick-up Location' : isDropOff ? 'Drop-off Location' : `Stop ${index} (Waypoint)`;

                  return (
                    <div key={index}>
                      <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          ref={(el) => (inputRefs.current[index] = el)}
                          type="text"
                          placeholder={`Enter ${label.toLowerCase()}...`}
                          value={address}
                          onChange={(e) => handleWaypointChange(index, e.target.value)}
                          className="flex-1 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-sm shadow-inner"
                        />
                        {isWaypoint && (
                          <button
                            type="button"
                            onClick={() => removeWaypoint(index)}
                            className="bg-red-950/40 hover:bg-red-900/50 text-red-400 w-11 h-11 rounded-xl border border-red-800/50 font-bold text-lg flex items-center justify-center transition cursor-pointer"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={addWaypoint}
                  className="w-full py-2.5 px-4 bg-[#1f2636] hover:bg-slate-700/70 border border-slate-700/80 text-blue-400 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-base font-bold">+</span> Add Waypoint Stop
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading || !isApiLoaded}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition duration-200 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer text-base"
                >
                  {loading ? 'Checking Routes & Geofences...' : 'Generate Quote'}
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3.5 px-5 rounded-xl border border-slate-700 transition duration-200 cursor-pointer text-base"
                >
                  Reset
                </button>
              </div>
            </form>

            {/* Results Display */}
            {quoteData && (
              <div className="mt-8 border-t border-slate-800/80 pt-8">
                
                {mapUrl && (
                  <div className="mb-6 rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-[#0b0f17]">
                    <iframe
                      title="Route Map"
                      width="100%"
                      height="260"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      src={mapUrl}
                    ></iframe>
                  </div>
                )}

                {/* Main Quote Card */}
                <div className="bg-gradient-to-b from-[#1c2436] to-[#121722] border border-blue-500/30 rounded-2xl p-6 text-center shadow-xl mb-6 relative">
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {quoteData.hasAfterHours && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition ${
                          activeOverrides.afterHours
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'
                        }`}
                      >
                        +25% After Hours
                        <button type="button" onClick={() => toggleOverride('afterHours')} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.afterHours ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasRoadClub && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition ${
                          activeOverrides.roadClub
                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                            : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'
                        }`}
                      >
                        +15% Road Club
                        <button type="button" onClick={() => toggleOverride('roadClub')} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.roadClub ? '✕' : '↺'}
                        </button>
                      </span>
                    )}

                    {quoteData.hasMetroZone && (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition ${
                          activeOverrides.metro
                            ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                            : 'bg-slate-800/80 text-slate-500 border-slate-700 line-through'
                        }`}
                      >
                        +28.57% Metro
                        <button type="button" onClick={() => toggleOverride('metro')} className="hover:text-white font-bold ml-0.5 cursor-pointer">
                          {activeOverrides.metro ? '✕' : '↺'}
                        </button>
                      </span>
                    )}
                  </div>

                  <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                    Estimated Quote Range ($125 – $135/hr)
                  </span>
                  <p className="text-4xl font-black text-white mt-2 tracking-tight">
                    ${currentMinQuote} – ${currentMaxQuote}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Rounded to nearest $25
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowDetails(!showDetails)}
                    className="mt-4 text-xs font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4 cursor-pointer transition"
                  >
                    {showDetails ? '▲ Hide Trip Breakdown' : '▼ Show Trip Breakdown'}
                  </button>
                </div>

                {/* Collapsible Trip Breakdown */}
                {showDetails && (
                  <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-5 space-y-3 text-sm mb-6 shadow-inner">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Route & Time Breakdown
                    </h3>

                    {quoteData.legsDetails.map((leg, i) => (
                      <div key={i} className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                        <span>{leg.label}</span>
                        <span className="font-semibold text-slate-200">{leg.minutes} mins</span>
                      </div>
                    ))}

                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Adjusted Drive Time (+10%)</span>
                      <span className="font-semibold text-slate-200">{quoteData.adjustedDriveMin} mins</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Load / Unload Flat Rate</span>
                      <span className="font-semibold text-slate-200">{quoteData.loadUnloadTime} mins</span>
                    </div>

                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Metro / Geofence Status</span>
                      <span className={`font-semibold ${quoteData.hasMetroZone && activeOverrides.metro ? 'text-purple-400' : 'text-slate-200'}`}>
                        {quoteData.hasMetroZone ? (activeOverrides.metro ? 'Applied (+28.57%)' : 'Removed (0%)') : 'No'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                      <span>Base Price Range (No Surcharges)</span>
                      <span className="font-semibold text-emerald-400">
                        ${quoteData.baseMinQuote} – ${quoteData.baseMaxQuote}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-1 text-base font-bold text-white">
                      <span>Total Billable Hours</span>
                      <span className="text-blue-400">{quoteData.totalHours} hrs</span>
                    </div>
                  </div>
                )}

                {/* Custom Rate Input */}
                <div className="bg-[#1f2636]/60 border border-slate-700/80 rounded-xl p-4 mb-6 shadow-md">
                  <label className="block text-xs uppercase tracking-wider font-semibold text-slate-300 mb-2">
                    Custom Hourly Rate
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-base">
                        $
                      </span>
                      <input
                        type="number"
                        placeholder="Enter rate (e.g. 150)"
                        value={customRate}
                        onChange={(e) => setCustomRate(e.target.value)}
                        className="w-full bg-[#0b0f17] border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-base"
                      />
                    </div>
                    {customCalculatedQuote !== null && (
                      <div className="bg-blue-600/20 border border-blue-500/40 rounded-lg px-4 py-2 text-right">
                        <span className="text-[10px] uppercase tracking-wider block text-blue-300 font-bold">
                          Custom Quote
                        </span>
                        <span className="text-xl font-extrabold text-white">
                          ${customCalculatedQuote}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Quote Logging */}
                <div className="bg-[#1f2636]/60 border border-slate-700/80 rounded-xl p-4 mb-6 space-y-3">
                  <span className="block text-xs uppercase tracking-wider font-semibold text-slate-300">
                    Log Quote to Database (Optional)
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Phone Number"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="bg-[#0b0f17] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleLogQuote}
                    disabled={isSaving}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg transition disabled:bg-slate-800 cursor-pointer"
                  >
                    {isSaving ? 'Saving Quote...' : '💾 Log Quote'}
                  </button>

                  {saveStatus && (
                    <p
                      className={`text-xs text-center font-medium ${
                        saveStatus.type === 'success' ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {saveStatus.message}
                    </p>
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}