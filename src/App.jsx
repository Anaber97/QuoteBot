import React, { useState, useEffect, useRef } from 'react';
import { SHOP_LOCATIONS } from './config/locations';
import { GEOFENCES } from './config/geofences';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

export default function App() {
  // Base Location Selection
  const [selectedBaseId, setSelectedBaseId] = useState(SHOP_LOCATIONS[0].id);
  const currentBase = SHOP_LOCATIONS.find((b) => b.id === selectedBaseId) || SHOP_LOCATIONS[0];

  // Dynamic Waypoints Array: [0] = Pick-up, [last] = Drop-off, middle = Stops
  const [waypoints, setWaypoints] = useState(['', '']);

  // Surcharge Options
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [isRoadClub, setIsRoadClub] = useState(false);
  const [isMetro, setIsMetro] = useState(false);

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

  // Attach Places Autocomplete to all waypoint inputs
  useEffect(() => {
    if (!isApiLoaded) return;

    const options = {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
    };

    waypoints.forEach((_, index) => {
      const ref = inputRefs.current[index];
      if (ref && !ref.dataset.autocompleteAttached) {
        const autocomplete = new window.google.maps.places.Autocomplete(ref, options);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.formatted_address) {
            handleWaypointChange(index, place.formatted_address);
          }
        });
        ref.dataset.autocompleteAttached = 'true';
      }
    });
  }, [isApiLoaded, waypoints.length]);

  const roundToNearest25 = (value) => Math.round(value / 25) * 25;

  // Waypoint Helpers
  const handleWaypointChange = (index, value) => {
    const updated = [...waypoints];
    updated[index] = value;
    setWaypoints(updated);
  };

  const addWaypoint = (index) => {
    const updated = [...waypoints];
    updated.splice(index + 1, 0, '');
    setWaypoints(updated);
  };

  const removeWaypoint = (index) => {
    if (waypoints.length <= 2) return; // Keep at least PU & DO
    const updated = waypoints.filter((_, i) => i !== index);
    setWaypoints(updated);
  };

  const handleReset = () => {
    setWaypoints(['', '']);
    setIsAfterHours(false);
    setIsRoadClub(false);
    setIsMetro(false);
    setMapUrl('');
    setCustomRate('');
    setQuoteData(null);
    setError(null);
  };

  // Helper to check if any address/route hits a specific geofence zone
  const checkGeofenceZone = async (zoneConfig, addresses) => {
    const isPointInBox = (lat, lng) => {
      const { box } = zoneConfig;
      return lat >= box.minLat && lat <= box.maxLat && lng >= box.minLng && lng <= box.maxLng;
    };

    // 1. Keyword check across all stops
    const hasKeyword = addresses.some((addr) =>
      zoneConfig.cities.some((city) => addr.toLowerCase().includes(city))
    );
    if (hasKeyword) return true;

    // 2. Geocode coordinates check
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

    // 3. Directions route inspection
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

    const puAddress = cleanWaypoints[0];
    const doAddress = cleanWaypoints[cleanWaypoints.length - 1];

    // Build embed map URL
    const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(
      puAddress
    )}&destination=${encodeURIComponent(doAddress)}&mode=driving`;
    setMapUrl(embedUrl);

    try {
      // Check DFW & Houston geofences in parallel
      const [hitDFW, hitHouston] = await Promise.all([
        checkGeofenceZone(GEOFENCES.dfw, cleanWaypoints),
        checkGeofenceZone(GEOFENCES.houston, cleanWaypoints),
      ]);

      // Full route sequence: Base -> PU -> Intermediate Stops -> DO -> Base
      const routePoints = [currentBase.address, ...cleanWaypoints, currentBase.address];
      const distanceService = new window.google.maps.DistanceMatrixService();

      // Fetch travel durations for each leg sequentially
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

      // Time calculations
      const totalDriveMinutes = totalDriveSeconds / 60;
      const adjustedDriveMinutes = totalDriveMinutes * 1.10; // +10% traffic buffer
      const loadUnloadTime = 30 + (cleanWaypoints.length - 2) * 15; // 30 min base + 15 min per extra stop
      const totalJobMinutes = adjustedDriveMinutes + loadUnloadTime;
      const totalHours = totalJobMinutes / 60;

      // Multipliers
      const afterHoursMult = isAfterHours ? 1.25 : 1.0;
      const roadClubMult = isRoadClub ? 1.15 : 1.0;
      const metroMult = isMetro ? 1.15 : 1.0;
      const dfwMult = hitDFW ? GEOFENCES.dfw.multiplier : 1.0;
      const houstonMult = hitHouston ? GEOFENCES.houston.multiplier : 1.0;

      const totalMultiplier = afterHoursMult * roadClubMult * metroMult * dfwMult * houstonMult;

      const minQuote = roundToNearest25(totalHours * 125 * totalMultiplier);
      const maxQuote = roundToNearest25(totalHours * 135 * totalMultiplier);

      const baseMinQuote = roundToNearest25(totalHours * 125);
      const baseMaxQuote = roundToNearest25(totalHours * 135);

      setQuoteData({
        legsDetails,
        adjustedDriveMin: Math.round(adjustedDriveMinutes),
        loadUnloadTime,
        rawTotalHours: totalHours,
        totalHours: totalHours.toFixed(2),
        minQuote,
        maxQuote,
        baseMinQuote,
        baseMaxQuote,
        afterHoursApplied: isAfterHours,
        roadClubApplied: isRoadClub,
        metroApplied: isMetro,
        dfwApplied: hitDFW,
        houstonApplied: hitHouston,
        totalMultiplier,
      });

      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError('An error occurred calculating driving legs or geofences.');
    }
  };

  const customCalculatedQuote =
    quoteData && customRate && !isNaN(parseFloat(customRate))
      ? roundToNearest25(
          quoteData.rawTotalHours * parseFloat(customRate) * quoteData.totalMultiplier
        )
      : null;

  return (
    <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-6 text-slate-200">
      <div className="max-w-xl w-full bg-[#161b26] rounded-2xl shadow-2xl p-8 border border-slate-800">
        
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
          
          {/* Surcharge Options Checkboxes */}
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
                Manual Metro Surcharge <span className="text-blue-400 font-bold">(+15%)</span>
              </label>
            </div>
          </div>

          {/* Dynamic Waypoints Array */}
          <div className="space-y-4">
            {waypoints.map((address, index) => {
              const isPickUp = index === 0;
              const isDropOff = index === waypoints.length - 1;
              const label = isPickUp
                ? 'Pick-up Location'
                : isDropOff
                ? 'Drop-off Location'
                : `Stop ${index} (Waypoint)`;

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

                    {/* Add Waypoint Button */}
                    <button
                      type="button"
                      onClick={() => addWaypoint(index)}
                      title="Add Waypoint Stop"
                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 w-11 h-11 rounded-xl border border-slate-700/80 font-bold text-xl flex items-center justify-center transition"
                    >
                      +
                    </button>

                    {/* Remove Waypoint Button (Hidden if only PU and DO remain) */}
                    {waypoints.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeWaypoint(index)}
                        title="Remove Stop"
                        className="bg-red-950/40 hover:bg-red-900/50 text-red-400 w-11 h-11 rounded-xl border border-red-800/50 font-bold text-lg flex items-center justify-center transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
            
            {/* Embedded Route Map */}
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
                {quoteData.afterHoursApplied && (
                  <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +25% After Hours
                  </span>
                )}
                {quoteData.roadClubApplied && (
                  <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +15% Road Club
                  </span>
                )}
                {quoteData.metroApplied && (
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +15% Metro
                  </span>
                )}
                {quoteData.dfwApplied && (
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +28.57% DFW Zone
                  </span>
                )}
                {quoteData.houstonApplied && (
                  <span className="bg-pink-500/20 text-pink-300 border border-pink-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +28.57% Houston Zone
                  </span>
                )}
              </div>

              <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                Estimated Quote Range ($125 – $135/hr)
              </span>
              <p className="text-4xl font-black text-white mt-2 tracking-tight">
                ${quoteData.minQuote} – ${quoteData.maxQuote}
              </p>
              <p className="text-xs text-slate-400 mt-2">
                Rounded to nearest $25
              </p>
            </div>

            {/* Custom Hourly Rate Input */}
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

            {/* Trip Breakdown */}
            <div className="bg-[#0b0f17] border border-slate-800 rounded-xl p-5 space-y-3 text-sm">
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
                <span>DFW Geofence Crossed</span>
                <span className={`font-semibold ${quoteData.dfwApplied ? 'text-purple-400' : 'text-slate-200'}`}>
                  {quoteData.dfwApplied ? 'Yes (+28.57%)' : 'No'}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Houston Geofence Crossed</span>
                <span className={`font-semibold ${quoteData.houstonApplied ? 'text-pink-400' : 'text-slate-200'}`}>
                  {quoteData.houstonApplied ? 'Yes (+28.57%)' : 'No'}
                </span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Base Price (No Surcharges)</span>
                <span className="font-semibold text-emerald-400">
                  ${quoteData.baseMinQuote} – ${quoteData.baseMaxQuote}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1 text-base font-bold text-white">
                <span>Total Billable Time</span>
                <span className="text-blue-400">{quoteData.totalHours} hrs</span>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}