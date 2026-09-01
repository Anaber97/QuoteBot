import { describe, test, expect, vi, beforeAll } from 'vitest';
import { calculateAuthoritativeQuote } from '../../api/_quoteEngine.js';

/**
 * TRUE BROWSER-VS-SERVER PARITY HARNESS
 *
 * Earlier "parity" tests only exercised pricingEngine.js / _quoteEngine.js
 * directly and never called the browser's public calculateQuoteData(), so
 * duplicated logic that still existed in quoteCalculator.js (drive-time
 * buffer + rate resolution) could silently drift from the server without
 * any test noticing. This feeds an equivalent route into BOTH public
 * calculation entry points (calculateQuoteData/calculateFinalQuotes on the
 * browser, calculateAuthoritativeQuote on the server) and asserts the
 * resulting quotes match.
 */

vi.mock('../../src/lib/googleMaps.js', () => ({
  loadGoogleMaps: vi.fn(async () => {}),
}));

// A fake google.maps.LatLng: real ones expose lat()/lng() as functions,
// which quoteCalculator.js's toPoint() checks for.
const fakeLatLng = (lat, lng) => ({ lat: () => lat, lng: () => lng });

function installFakeGoogleMaps({ legs }) {
  global.window.google = {
    maps: {
      TravelMode: { DRIVING: 'DRIVING' },
      DirectionsService: class {
        route(_request, callback) {
          callback({ routes: [{ legs }] }, 'OK');
        }
      },
      Geocoder: class {
        geocode(_request, callback) {
          callback([], 'ZERO_RESULTS');
        }
      },
    },
  };
}

// Base -> pickup -> dropoff -> base, matching a 3-leg round trip.
const LEG_BASE_TO_PICKUP = { duration: { value: 600 }, distance: { value: 8046.72 }, end_location: fakeLatLng(0, 0), steps: [] };
const LEG_PICKUP_TO_DROPOFF = { duration: { value: 1200 }, distance: { value: 16093.44 }, end_location: fakeLatLng(0, 0), steps: [{ path: [fakeLatLng(0, 0)] }] };
const LEG_DROPOFF_TO_BASE = { duration: { value: 600 }, distance: { value: 8046.72 }, end_location: fakeLatLng(0, 0), steps: [] };
const ROUTE_LEGS = [LEG_BASE_TO_PICKUP, LEG_PICKUP_TO_DROPOFF, LEG_DROPOFF_TO_BASE];

const BASE_ADDRESS = '100 Test Ave, Nowhereville';
const PICKUP_ADDRESS = '200 Test Blvd, Nowhereville';
const DROPOFF_ADDRESS = '300 Test Cir, Nowhereville';

const sharedConfig = {
  pricing: {
    pricing_mode: 'hourly',
    hourly_min: 125,
    hourly_max: 150,
    mileage_min: 5,
    mileage_max: 6,
    drive_time_buffer: 10,
    load_unload_base_mins: 30,
    extra_stop_mins: 15,
    rounding_interval: 25,
    custom_truck_classes: [],
    custom_surcharges: [],
  },
  surcharges: {},
  geofences: { disabledZones: [], customZoneRates: {}, customZones: [] },
  bases: [{ id: 'base-1', name: 'Main Yard', address: BASE_ADDRESS }],
  client_portal: { weight_tiers: [], approval_threshold: 80000 },
};

async function runBrowserPath({ isHeavy = false } = {}) {
  const { calculateQuoteData, calculateFinalQuotes } = await import('../../src/services/quoteCalculator.js');
  const quoteData = await calculateQuoteData({
    currentBase: sharedConfig.bases[0],
    waypoints: [PICKUP_ADDRESS, DROPOFF_ADDRESS],
    selectedTruckClassId: '',
    isHeavy,
    companyRates: sharedConfig,
  });
  const { currentMinQuote, currentMaxQuote } = calculateFinalQuotes(quoteData, {}, null, sharedConfig, null);
  return { minQuote: currentMinQuote, maxQuote: currentMaxQuote, totalMiles: quoteData.totalMiles, totalHours: quoteData.totalHours };
}

function runServerPath({ isHeavy = false } = {}) {
  return calculateAuthoritativeQuote({
    role: 'dispatch',
    clientConfig: null,
    input: {
      waypoints: [PICKUP_ADDRESS, DROPOFF_ADDRESS],
      selectedTruckClassId: '',
      isHeavy,
      isAfterHours: false,
      isRoadClub: false,
      activeOverrides: {},
      customRate: null,
      customLoadUnloadMins: null,
      equipment: { weight: 5000, width: 90, height: 100 }, // below permit thresholds
    },
    config: sharedConfig,
    route: {
      totalMeters: ROUTE_LEGS.reduce((sum, leg) => sum + leg.distance.value, 0),
      rawDriveMinutes: ROUTE_LEGS.reduce((sum, leg) => sum + leg.duration.value, 0) / 60,
      customerRoutePoints: [{ lat: 0, lng: 0 }],
      legs: ROUTE_LEGS.map((leg) => ({ durationMinutes: leg.duration.value / 60, distanceMeters: leg.distance.value })),
      localities: [],
    },
  });
}

describe('browser vs. server quote parity (real public entry points)', () => {
  beforeAll(() => {
    installFakeGoogleMaps({ legs: ROUTE_LEGS });
  });

  test('hourly mode: identical route + config produce identical quotes on both sides', async () => {
    const browser = await runBrowserPath();
    const server = runServerPath();

    expect(browser.totalMiles).toBeCloseTo(server.totalMiles, 5);
    expect(browser.totalHours).toBeCloseTo(server.totalHours, 2);
    expect(browser.minQuote).toBe(server.minQuote);
    expect(browser.maxQuote).toBe(server.maxQuote);
  });

  test('heavy-equipment surcharge resolves to the same rate on both sides', async () => {
    const browser = await runBrowserPath({ isHeavy: true });
    const server = runServerPath({ isHeavy: true });

    expect(browser.minQuote).toBe(server.minQuote);
    expect(browser.maxQuote).toBe(server.maxQuote);
  });

  test('mileage pricing mode produces identical quotes on both sides', async () => {
    const mileageConfig = { ...sharedConfig, pricing: { ...sharedConfig.pricing, pricing_mode: 'mileage' } };
    const { calculateQuoteData, calculateFinalQuotes } = await import('../../src/services/quoteCalculator.js');
    const quoteData = await calculateQuoteData({
      currentBase: mileageConfig.bases[0],
      waypoints: [PICKUP_ADDRESS, DROPOFF_ADDRESS],
      companyRates: mileageConfig,
    });
    const browser = calculateFinalQuotes(quoteData, {}, null, mileageConfig, null);

    const server = calculateAuthoritativeQuote({
      role: 'dispatch',
      clientConfig: null,
      input: { waypoints: [PICKUP_ADDRESS, DROPOFF_ADDRESS], selectedTruckClassId: '', isHeavy: false, isAfterHours: false, isRoadClub: false, activeOverrides: {}, customRate: null, customLoadUnloadMins: null, equipment: { weight: 5000, width: 90, height: 100 } },
      config: mileageConfig,
      route: {
        totalMeters: ROUTE_LEGS.reduce((sum, leg) => sum + leg.distance.value, 0),
        rawDriveMinutes: ROUTE_LEGS.reduce((sum, leg) => sum + leg.duration.value, 0) / 60,
        customerRoutePoints: [{ lat: 0, lng: 0 }],
        legs: [],
        localities: [],
      },
    });

    expect(browser.currentMinQuote).toBe(server.minQuote);
    expect(browser.currentMaxQuote).toBe(server.maxQuote);
  });
});
