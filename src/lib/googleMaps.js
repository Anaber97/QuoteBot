// src/lib/googleMaps.js
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js-sdk';
let googleMapsPromise = null;

export function loadGoogleMaps(options = {}) {
  const {
    requirePlaces = true,
    requireDistanceMatrix = true,
    requireDrawing = false,
  } = options;

  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
  }

  const isReady = () => {
    if (!window.google?.maps) return false;
    if (requirePlaces && !window.google.maps.places) return false;
    if (requireDistanceMatrix && !window.google.maps.DistanceMatrixService) return false;
    if (requireDrawing && !window.google.maps.drawing?.DrawingManager) return false;
    return true;
  };

  // 1. If already initialized on window, resolve immediately
  if (isReady()) {
    return Promise.resolve(window.google);
  }

  // 2. Return active loading promise if currently loading
  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY in your environment variables.'));
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    // Check if script tag already exists in <head>
    let script = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    const libraries = [];
    if (requirePlaces) libraries.push('places');
    if (requireDrawing) libraries.push('drawing');

    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      // NOTE: Do NOT use loading=async here, as it delays class definitions
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}${libraries.length ? `&libraries=${libraries.join(',')}` : ''}`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkLoaded = () => {
      if (isReady()) {
        resolve(window.google);
      } else {
        setTimeout(checkLoaded, 50);
      }
    };

    script.addEventListener('load', checkLoaded);
    script.addEventListener('error', () => {
      googleMapsPromise = null;
      reject(new Error('Google Maps script failed to load. Check API Key or network.'));
    });

    // If script was already loaded by index.html
    if (window.google?.maps) {
      checkLoaded();
    }
  });

  return googleMapsPromise;
}