import test from 'node:test';
import assert from 'node:assert/strict';

import { compareYardLegs } from '../api/_yardMatrix.js';
import { rankYards } from '../src/features/quotes/yardComparison.js';

const bases = [
  { id: 'henderson', name: 'Henderson yard', address: '120 Taylor St, Henderson, TX' },
  { id: 'tyler', name: 'Tyler yard', address: '1500 W Front St, Tyler, TX' },
  { id: 'longview', name: 'Longview yard', address: '900 E Marshall Ave, Longview, TX' },
];

test('compareYardLegs asks for 2 × yards matrix elements and reads omitted zero indexes', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push(body);
    // Google omits zero-valued indexes in JSON responses.
    const outbound = [{ duration: '1680s', distanceMeters: 30000, condition: 'ROUTE_EXISTS' }, { originIndex: 1, duration: '600s', distanceMeters: 9000, condition: 'ROUTE_EXISTS' }, { originIndex: 2, duration: '1200s', distanceMeters: 20000, condition: 'ROUTE_NOT_FOUND' }];
    const inbound = [{ duration: '2400s', distanceMeters: 50000, condition: 'ROUTE_EXISTS' }, { destinationIndex: 1, duration: '300s', distanceMeters: 4000, condition: 'ROUTE_EXISTS' }, { destinationIndex: 2, duration: '900s', distanceMeters: 15000, condition: 'ROUTE_EXISTS' }];
    return Response.json(body.origins.length > 1 ? outbound : inbound);
  };
  const yards = await compareYardLegs(bases, 'Kilgore, TX', 'Tyler, TX', { apiKey: 'test', fetchImpl });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].origins.length * calls[0].destinations.length + calls[1].origins.length * calls[1].destinations.length, 6);
  assert.deepEqual(yards.map((yard) => yard.id), ['henderson', 'tyler']); // Longview had no route out
  assert.equal(yards[1].outMinutes, 10);
  assert.equal(yards[1].backMinutes, 5);
});

test('compareYardLegs makes no Google call with fewer than two yards', async () => {
  let called = false;
  const yards = await compareYardLegs([bases[0]], 'Kilgore, TX', 'Tyler, TX', { apiKey: 'test', fetchImpl: async () => { called = true; } });
  assert.deepEqual(yards, []);
  assert.equal(called, false);
});

test('rankYards re-prices only the drive out and back, and returns cheaper yards best first', () => {
  const quoteData = { rawTotalHours: 2, totalMiles: 80, driveTimeBufferPercent: 10 };
  const yards = [
    { id: 'henderson', name: 'Henderson yard', outMinutes: 30, backMinutes: 40, outMeters: 30000, backMeters: 50000 },
    { id: 'tyler', name: 'Tyler yard', outMinutes: 10, backMinutes: 5, outMeters: 9000, backMeters: 4000 },
    { id: 'longview', name: 'Longview yard', outMinutes: 50, backMinutes: 60, outMeters: 60000, backMeters: 80000 },
  ];
  // $100 per billable hour, rounded to $25, like the ticket.
  const priceFor = (data) => Math.round((data.rawTotalHours * 100) / 25) * 25;
  const ranked = rankYards({ yards, currentYardId: 'henderson', quoteData, priceFor });
  assert.deepEqual(ranked.map((yard) => yard.id), ['tyler']);
  assert.equal(ranked[0].minutesSaved, 55);
  // 55 fewer minutes × 1.1 buffer = 1.008 h less: $200 → $100.
  assert.equal(ranked[0].savings, 100);
});

test('rankYards stays quiet without the current yard or a cheaper option', () => {
  const quoteData = { rawTotalHours: 1, totalMiles: 20, driveTimeBufferPercent: 0 };
  const priceFor = (data) => data.rawTotalHours * 100;
  assert.deepEqual(rankYards({ yards: [], currentYardId: 'x', quoteData, priceFor }), []);
  const yards = [
    { id: 'a', name: 'A', outMinutes: 10, backMinutes: 10, outMeters: 1, backMeters: 1 },
    { id: 'b', name: 'B', outMinutes: 20, backMinutes: 20, outMeters: 2, backMeters: 2 },
  ];
  assert.deepEqual(rankYards({ yards, currentYardId: 'a', quoteData, priceFor }), []);
});
