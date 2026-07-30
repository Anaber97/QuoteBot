import React, { useState, useEffect, useRef } from 'react';

// ==========================================
// CONFIGURATION
// ==========================================
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const HOME_BASE_ADDRESS = '120 Taylor St, Henderson, TX';

// DFW Lat/Lng Box Boundaries
const DFW_BOX = {
  minLat: 32.3000, // South (Waxahachie)
  maxLat: 33.3500, // North (Denton / McKinney)
  minLng: -97.5000, // West (Weatherford / Fort Worth)
  maxLng: -96.3000, // East (Rockwall / Terrell)
};

// Major DFW area keywords for fail-safe fallback
const DFW_CITIES = [
  'dallas', 'fort worth', 'arlington', 'plano', 'irving', 'garland', 
  'grand prairie', 'mckinney', 'frisco', 'carrollton', 'denton', 
  'richardson', 'lewisville', 'mesquite', 'grapevine', 'euless', 
  'bedford', 'hurst', 'rockwall', 'rowlett', 'desoto', 'cedar hill'
];
// ==========================================

export default function App() {
  const [puAddress, setPuAddress] = useState('');
  const [doAddress, setDoAddress] = useState('');
  const [isAfterHours, setIsAfterHours] = useState(false);
  const [isRoadClub, setIsRoadClub] = useState(false); // Road Club state
  const [mapUrl, setMapUrl] = useState('');
  const [customRate, setCustomRate] = useState('');
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quoteData, setQuoteData] = useState(null);

  const puInputRef = useRef(null);
  const doInputRef = useRef(null);

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

  useEffect(() => {
    if (!isApiLoaded) return;

    const options = {
      types: ['geocode', 'establishment'],
      componentRestrictions: { country: 'us' },
    };

    if (puInputRef.current) {
      const puAutocomplete = new window.google.maps.places.Autocomplete(
        puInputRef.current,
        options
      );
      puAutocomplete.addListener('place_changed', () => {
        const place = puAutocomplete.getPlace();
        if (place.formatted_address) setPuAddress(place.formatted_address);
      });
    }

    if (doInputRef.current) {
      const doAutocomplete = new window.google.maps.places.Autocomplete(
        doInputRef.current,
        options
      );
      doAutocomplete.addListener('place_changed', () => {
        const place = doAutocomplete.getPlace();
        if (place.formatted_address) setDoAddress(place.formatted_address);
      });
    }
  }, [isApiLoaded]);

  const roundToNearest25 = (value) => Math.round(value / 25) * 25;

  const handleReset = () => {
    setPuAddress('');
    setDoAddress('');
    setIsAfterHours(false);
    setIsRoadClub(false);
    setMapUrl('');
    setCustomRate('');
    setQuoteData(null);
    setError(null);
  };

  const checkCityLocality = (address) => {
    return new Promise((resolve) => {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results[0]) {
          const localityComponent = results[0].address_components.find((c) =>
            c.types.includes('locality')
          );
          resolve(localityComponent ? localityComponent.long_name : null);
        } else {
          resolve(null);
        }
      });
    });
  };

  const checkRouteCrossesDFW = async (pu, doAddr) => {
    const isPointInDFW = (lat, lng) => {
      return (
        lat >= DFW_BOX.minLat &&
        lat <= DFW_BOX.maxLat &&
        lng >= DFW_BOX.minLng &&
        lng <= DFW_BOX.maxLng
      );
    };

    // 1. Text Keyword Check
    const lowerPu = pu.toLowerCase();
    const lowerDo = doAddr.toLowerCase();
    const hasDfwKeyword = DFW_CITIES.some(
      (city) => lowerPu.includes(city) || lowerDo.includes(city)
    );
    if (hasDfwKeyword) return true;

    // 2. Geocode Check
    const geocoder = new window.google.maps.Geocoder();
    const geocodeAddress = (addr) =>
      new Promise((res) => {
        geocoder.geocode({ address: addr }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const loc = results[0].geometry.location;
            res({ lat: loc.lat(), lng: loc.lng() });
          } else {
            res(null);
          }
        });
      });

    const [puCoords, doCoords] = await Promise.all([
      geocodeAddress(pu),
      geocodeAddress(doAddr),
    ]);

    if (
      (puCoords && isPointInDFW(puCoords.lat, puCoords.lng)) ||
      (doCoords && isPointInDFW(doCoords.lat, doCoords.lng))
    ) {
      return true;
    }

    // 3. DirectionsService Route Inspection
    return new Promise((resolve) => {
      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route(
        {
          origin: pu,
          destination: doAddr,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === 'OK' && result.routes[0]) {
            const leg = result.routes[0].legs[0];

            const startLat = leg.start_location.lat();
            const startLng = leg.start_location.lng();
            const endLat = leg.end_location.lat();
            const endLng = leg.end_location.lng();

            if (isPointInDFW(startLat, startLng) || isPointInDFW(endLat, endLng)) {
              resolve(true);
              return;
            }

            const steps = leg.steps || [];
            const passesThrough = steps.some((step) =>
              (step.path || []).some((pt) => isPointInDFW(pt.lat(), pt.lng()))
            );

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

    if (!puAddress || !doAddress) {
      setError('Please provide both Pick-up and Drop-off addresses.');
      return;
    }

    if (!isApiLoaded) {
      setError('Google Maps SDK is still loading...');
      return;
    }

    setLoading(true);
    setError(null);

    const embedUrl = `https://www.google.com/maps/embed/v1/directions?key=${GOOGLE_MAPS_API_KEY}&origin=${encodeURIComponent(
      puAddress
    )}&destination=${encodeURIComponent(doAddress)}&mode=driving`;

    setMapUrl(embedUrl);

    try {
      const [puCity, doCity, passesThroughDFW] = await Promise.all([
        checkCityLocality(puAddress),
        checkCityLocality(doAddress),
        checkRouteCrossesDFW(puAddress, doAddress),
      ]);

      const isHendersonLocal = puCity === 'Henderson' && doCity === 'Henderson';
      const isKilgoreLocal = puCity === 'Kilgore' && doCity === 'Kilgore';

      const service = new window.google.maps.DistanceMatrixService();

      service.getDistanceMatrix(
        {
          origins: [HOME_BASE_ADDRESS, puAddress, doAddress],
          destinations: [puAddress, doAddress, HOME_BASE_ADDRESS],
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (response, status) => {
          setLoading(false);

          if (status !== 'OK') {
            setError(`Google Maps Error: ${status}`);
            return;
          }

          try {
            const leg1Sec = response.rows[0].elements[0].duration.value;
            const leg2Sec = response.rows[1].elements[1].duration.value;
            const leg3Sec = response.rows[2].elements[2].duration.value;

            const totalStandardSec = leg1Sec + leg2Sec + leg3Sec;
            const totalStandardMin = totalStandardSec / 60;
            const adjustedDriveMin = totalStandardMin * 1.10;
            const totalJobMinutes = adjustedDriveMin + 30;
            const totalHours = totalJobMinutes / 60;

            const afterHoursMult = isAfterHours ? 1.25 : 1.0;
            const roadClubMult = isRoadClub ? 1.15 : 1.0;
            const dfwMult = passesThroughDFW ? 1.2857 : 1.0;
            const totalMultiplier = afterHoursMult * roadClubMult * dfwMult;

            if (isHendersonLocal || isKilgoreLocal) {
              const baseFlat = 100;
              const finalFlat = roundToNearest25(baseFlat * totalMultiplier);

              setQuoteData({
                isFlatRate: true,
                cityName: isHendersonLocal ? 'Henderson' : 'Kilgore',
                flatRateAmount: finalFlat,
                baseFlatRateAmount: baseFlat,
                leg1Min: Math.round(leg1Sec / 60),
                leg2Min: Math.round(leg2Sec / 60),
                leg3Min: Math.round(leg3Sec / 60),
                adjustedDriveMin: Math.round(adjustedDriveMin),
                rawTotalHours: totalHours,
                totalHours: totalHours.toFixed(2),
                afterHoursApplied: isAfterHours,
                roadClubApplied: isRoadClub,
                dfwSurchargeApplied: passesThroughDFW,
                totalMultiplier,
              });
            } else {
              const minQuote = roundToNearest25(totalHours * 125 * totalMultiplier);
              const maxQuote = roundToNearest25(totalHours * 135 * totalMultiplier);

              const baseMinQuote = roundToNearest25(totalHours * 125);
              const baseMaxQuote = roundToNearest25(totalHours * 135);

              setQuoteData({
                isFlatRate: false,
                leg1Min: Math.round(leg1Sec / 60),
                leg2Min: Math.round(leg2Sec / 60),
                leg3Min: Math.round(leg3Sec / 60),
                adjustedDriveMin: Math.round(adjustedDriveMin),
                rawTotalHours: totalHours,
                totalHours: totalHours.toFixed(2),
                minQuote,
                maxQuote,
                baseMinQuote,
                baseMaxQuote,
                afterHoursApplied: isAfterHours,
                roadClubApplied: isRoadClub,
                dfwSurchargeApplied: passesThroughDFW,
                totalMultiplier,
              });
            }
          } catch (err) {
            setError('Could not calculate route. Check address details.');
          }
        }
      );
    } catch (err) {
      setLoading(false);
      setError('An error occurred checking city boundaries or DFW geofence.');
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
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
            Towing Quote Calculator
          </h1>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 bg-[#1f2636] border border-slate-700/60 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Base: <span className="text-slate-200 font-semibold">{HOME_BASE_ADDRESS}</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/40 text-red-400 border border-red-800/50 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Inputs Form */}
        <form onSubmit={handleCalculate} className="space-y-6">
          
          {/* Checkboxes Placed Above Location Fields for Tabbing Flow */}
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="afterHours"
                checked={isAfterHours}
                onChange={(e) => setIsAfterHours(e.target.checked)}
                className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
              />
              <label htmlFor="afterHours" className="text-sm font-medium text-slate-200 cursor-pointer flex-1">
                After Hours / Weekend Callout <span className="text-xs text-blue-400 font-bold ml-1">(+25%)</span>
              </label>
            </div>

            <div className="flex items-center gap-3 bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3 cursor-pointer select-none">
              <input
                type="checkbox"
                id="roadClub"
                checked={isRoadClub}
                onChange={(e) => setIsRoadClub(e.target.checked)}
                className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
              />
              <label htmlFor="roadClub" className="text-sm font-medium text-slate-200 cursor-pointer flex-1">
                Road Club Account <span className="text-xs text-blue-400 font-bold ml-1">(+15%)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Pick-up Location
            </label>
            <input
              ref={puInputRef}
              type="text"
              placeholder="Start typing pick-up address..."
              value={puAddress}
              onChange={(e) => setPuAddress(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-base transition shadow-inner"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-semibold text-slate-400 mb-2">
              Drop-off Location
            </label>
            <input
              ref={doInputRef}
              type="text"
              placeholder="Start typing drop-off address..."
              value={doAddress}
              onChange={(e) => setDoAddress(e.target.value)}
              className="w-full bg-[#0b0f17] border border-slate-700/80 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:outline-none text-base transition shadow-inner"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !isApiLoaded}
              className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-blue-600/20 transition duration-200 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer text-base"
            >
              {loading ? 'Checking Geofence & Route...' : 'Generate Quote'}
            </button>

            {(puAddress || doAddress || quoteData) && (
              <button
                type="button"
                onClick={handleReset}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold py-3.5 px-5 rounded-xl border border-slate-700 transition duration-200 cursor-pointer text-base"
              >
                Reset
              </button>
            )}
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
                {quoteData.dfwSurchargeApplied && (
                  <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                    +28.57% DFW Zone
                  </span>
                )}
              </div>

              {quoteData.isFlatRate ? (
                <>
                  <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">
                    Local {quoteData.cityName} Flat Rate
                  </span>
                  <p className="text-5xl font-black text-white mt-2 tracking-tight">
                    ${quoteData.flatRateAmount}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    In-city limits transfer rate applied
                  </p>
                </>
              ) : (
                <>
                  <span className="text-xs uppercase tracking-widest font-bold text-blue-400">
                    Estimated Quote Range ($125 – $135/hr)
                  </span>
                  <p className="text-4xl font-black text-white mt-2 tracking-tight">
                    ${quoteData.minQuote} – ${quoteData.maxQuote}
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    Rounded to nearest $25
                  </p>
                </>
              )}
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
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Base → Pick-up</span>
                <span className="font-semibold text-slate-200">{quoteData.leg1Min} mins</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Pick-up → Drop-off</span>
                <span className="font-semibold text-slate-200">{quoteData.leg2Min} mins</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Drop-off → Base</span>
                <span className="font-semibold text-slate-200">{quoteData.leg3Min} mins</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Adjusted Drive Time (+10%)</span>
                <span className="font-semibold text-slate-200">{quoteData.adjustedDriveMin} mins</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Load / Unload Flat Rate</span>
                <span className="font-semibold text-slate-200">30 mins</span>
              </div>

              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>DFW Geofence Crossed</span>
                <span className={`font-semibold ${quoteData.dfwSurchargeApplied ? 'text-purple-400' : 'text-slate-200'}`}>
                  {quoteData.dfwSurchargeApplied ? 'Yes (+28.57%)' : 'No'}
                </span>
              </div>

              {/* Base Price Without Surcharges */}
              <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-800">
                <span>Base Price (No Surcharge)</span>
                <span className="font-semibold text-emerald-400">
                  {quoteData.isFlatRate
                    ? `$${quoteData.baseFlatRateAmount}`
                    : `$${quoteData.baseMinQuote} – $${quoteData.baseMaxQuote}`}
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