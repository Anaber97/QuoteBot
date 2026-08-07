// src/lib/googleMaps.js
const GOOGLE_MAPS_SCRIPT_ID = 'google-maps-js-sdk';
let googleMapsPromise = null;

export function loadGoogleMaps() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'));
  }

  // 1. If already initialized on window, resolve immediately
  if (window.google?.maps?.places && window.google?.maps?.DistanceMatrixService) {
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

    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_MAPS_SCRIPT_ID;
      // NOTE: Do NOT use loading=async here, as it delays class definitions
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry,drawing`;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const checkLoaded = () => {
      if (window.google?.maps?.DistanceMatrixService && window.google?.maps?.places) {
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